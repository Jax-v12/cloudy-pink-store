import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  verifyTelegramSecretToken,
  isAuthorizedTelegramSender,
  otpRequestNotification,
  parseTelegramOtpCommand,
  formatTelegramOtpReplyMessage,
} from '../src/lib/telegramWebhook.ts';
import { OTP_REPLY_PREFIX, OTP_REQUEST_ACTION } from '../src/lib/appsOtp.ts';

process.env.ENCRYPTION_KEY ||= 'test-encryption-key-32-bytes-minimum';

let mockOrder = null;
let mockAudits = [];
let mockReceipts = new Map();
let nextAuditId = 500;
let failDb = false;
let failTelegramSend = false;
let sentTelegramMessages = [];
const originalFetch = globalThis.fetch;

function matchesOtpAuditWhere(audit, where) {
  if (where.id !== undefined && audit.id !== where.id) return false;
  if (where.orderId !== undefined && audit.orderId !== where.orderId) return false;
  if (where.action !== undefined && audit.action !== where.action) return false;
  if (where.OR) {
    return (
      audit.action === OTP_REQUEST_ACTION ||
      (typeof audit.action === 'string' && audit.action.startsWith(OTP_REPLY_PREFIX))
    );
  }
  return true;
}

const mockDb = {
  $queryRaw: async (_strings, ...values) => {
    if (failDb) throw new Error('synthetic db outage');
    const id = Number(values[0]);
    if (mockOrder && mockOrder.id === id) return [structuredClone(mockOrder)];
    return [];
  },
  adminAudit: {
    findFirst: async ({ where }) => {
      if (failDb) throw new Error('synthetic db outage');
      const matched = mockAudits
        .filter((a) => matchesOtpAuditWhere(a, where))
        .sort((a, b) => b.id - a.id);
      if (matched.length === 0) return null;
      const top = matched[0];
      return { id: top.id, orderId: top.orderId, action: top.action, createdAt: top.createdAt };
    },
    create: async ({ data }) => {
      if (failDb) throw new Error('synthetic db outage');
      const entry = {
        id: ++nextAuditId,
        orderId: data.orderId,
        sessionId: data.sessionId ?? 'telegram',
        action: data.action,
        createdAt: new Date(),
      };
      mockAudits.push(entry);
      return { id: entry.id, action: entry.action, createdAt: entry.createdAt };
    },
  },
  telegramUpdateReceipt: {
    findUnique: async ({ where }) => {
      if (failDb) throw new Error('synthetic db outage');
      const found = mockReceipts.get(String(where.updateId));
      return found ? structuredClone(found) : null;
    },
    create: async ({ data }) => {
      if (failDb) throw new Error('synthetic db outage');
      const key = String(data.updateId);
      if (mockReceipts.has(key)) {
        const err = new Error('Unique constraint failed');
        err.code = 'P2002';
        throw err;
      }
      const entry = {
        updateId: data.updateId,
        orderId: data.orderId ?? null,
        requestId: data.requestId ?? null,
        outcome: data.outcome,
        createdAt: new Date(),
      };
      mockReceipts.set(key, entry);
      return structuredClone(entry);
    },
  },
  $transaction: async (callback) => {
    if (failDb) throw new Error('synthetic db outage');
    return await callback(mockDb);
  },
};

globalThis.prisma = mockDb;
const { POST: telegramWebhookPost } = await import('../src/app/api/webhook/telegram/route.ts');

describe('telegramWebhook pure helpers', () => {
  it('verifies Telegram webhook secret token in constant time and fails closed', () => {
    assert.equal(verifyTelegramSecretToken('', 'any-header'), false);
    assert.equal(verifyTelegramSecretToken(undefined, 'any-header'), false);
    assert.equal(verifyTelegramSecretToken('Valid_Secret-123', null), false);
    assert.equal(verifyTelegramSecretToken('Valid_Secret-123', 'short'), false);
    assert.equal(verifyTelegramSecretToken('Valid_Secret-123', 'Valid_Secret-124'), false);
    assert.equal(verifyTelegramSecretToken('Valid_Secret-123', 'Valid_Secret-123'), true);
  });

  it('authorizes private chat and enforces sender allowlist in group chats', () => {
    assert.equal(
      isAuthorizedTelegramSender(
        { id: 7694473069, type: 'private' },
        { id: 7694473069, is_bot: false },
        '7694473069',
        '',
      ),
      true,
    );

    // Rejects bots
    assert.equal(
      isAuthorizedTelegramSender(
        { id: 7694473069, type: 'private' },
        { id: 7694473069, is_bot: true },
        '7694473069',
        '',
      ),
      false,
    );

    // Group chat without TELEGRAM_ADMIN_USER_IDS is rejected
    assert.equal(
      isAuthorizedTelegramSender(
        { id: -100123456789, type: 'supergroup' },
        { id: 7694473069, is_bot: false },
        '-100123456789',
        '',
      ),
      false,
    );

    // Group chat with allowlisted sender is accepted
    assert.equal(
      isAuthorizedTelegramSender(
        { id: -100123456789, type: 'supergroup' },
        { id: 7694473069, is_bot: false },
        '-100123456789',
        '7694473069, 99887766',
      ),
      true,
    );
  });

  it('parses direct command /otp <invoice> #<requestId> <code> and swipe replies', () => {
    const res = parseTelegramOtpCommand('/otp INV-20261018-001 #42 482910');
    assert.deepEqual(res, {
      invoice: 'INV-20261018-001',
      requestId: 42,
      code: '482910',
    });

    const replyText = otpRequestNotification('INV-20261018-ABC', 108, 35000);

    // Swipe reply with /otp prefix
    assert.deepEqual(parseTelegramOtpCommand('/otp 918234', replyText), {
      invoice: 'INV-20261018-ABC',
      requestId: 108,
      code: '918234',
    });

    // Swipe reply without /otp prefix (just the code)
    assert.deepEqual(parseTelegramOtpCommand('918234', replyText), {
      invoice: 'INV-20261018-ABC',
      requestId: 108,
      code: '918234',
    });
  });

  it('identifies missing requestId when /otp <invoice> <code> is sent without #requestId', () => {
    assert.equal(parseTelegramOtpCommand(''), null);
    assert.equal(parseTelegramOtpCommand('/help'), null);
    assert.equal(parseTelegramOtpCommand('/otp 12'), null);
    assert.deepEqual(parseTelegramOtpCommand('/otp INV-20261018-001 482910'), {
      invoice: 'INV-20261018-001',
      requestId: null,
      code: '482910',
    });
    assert.deepEqual(parseTelegramOtpCommand('918234', 'Invoice: INV-20261018-ABC without req id'), {
      invoice: 'INV-20261018-ABC',
      requestId: null,
      code: '918234',
    });
  });

  it('never echoes OTP code in bot confirmation messages', () => {
    const secretCode = 'SECRET-OTP-998877';
    const msg = formatTelegramOtpReplyMessage('DELIVERED', 'INV-20261018-001', 42);
    assert.equal(msg.includes('INV-20261018-001'), true);
    assert.equal(msg.includes('#42'), true);
    assert.equal(msg.includes(secretCode), false);
  });
});

describe('POST /api/webhook/telegram route', () => {
  beforeEach(() => {
    globalThis.prisma = mockDb;
    process.env.TELEGRAM_WEBHOOK_SECRET = 'Secret_Webhook_Token_2026';
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '7694473069';
    process.env.TELEGRAM_ADMIN_USER_IDS = '';
    failDb = false;
    failTelegramSend = false;
    sentTelegramMessages = [];
    mockReceipts = new Map();
    mockOrder = {
      id: 1,
      invoice: 'INV-TELE-001',
      totalAmount: 35000,
      type: 'APPS',
      status: 'PAID',
      accountStockId: 5,
      removedFromAdminAt: null,
      refundStatus: 'NONE',
    };
    mockAudits = [
      {
        id: 501,
        orderId: 1,
        sessionId: 'customer-otp',
        action: OTP_REQUEST_ACTION,
        createdAt: new Date(),
      },
    ];
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('api.telegram.org')) {
        if (failTelegramSend) {
          return new Response('Bad Gateway', { status: 502 });
        }
        const parsed = JSON.parse(String(init?.body || '{}'));
        sentTelegramMessages.push(parsed.text);
        return Response.json({ ok: true });
      }
      return originalFetch(url, init);
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
    delete globalThis.prisma;
  });

  it('returns 503 when TELEGRAM_WEBHOOK_SECRET is not configured', async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET = '';
    const req = new Request('https://example.test/api/webhook/telegram', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 1001 }),
    });
    const res = await telegramWebhookPost(req);
    assert.equal(res.status, 503);
    assert.equal(mockAudits.length, 1);
    assert.equal(sentTelegramMessages.length, 0);
  });

  it('returns 401 when x-telegram-bot-api-secret-token is missing or invalid', async () => {
    const reqMissing = new Request('https://example.test/api/webhook/telegram', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ update_id: 1001 }),
    });
    assert.equal((await telegramWebhookPost(reqMissing)).status, 401);

    const reqInvalid = new Request('https://example.test/api/webhook/telegram', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'Wrong_Secret',
      },
      body: JSON.stringify({ update_id: 1001 }),
    });
    assert.equal((await telegramWebhookPost(reqInvalid)).status, 401);
    assert.equal(mockAudits.length, 1);
  });

  it('commits OTP reply, deduplicates replayed update_id, and never echoes code in bot reply', async () => {
    const payload = {
      update_id: 9001,
      message: {
        chat: { id: 7694473069, type: 'private' },
        from: { id: 7694473069, is_bot: false },
        text: '/otp INV-TELE-001 #501 849201',
      },
    };
    const makeReq = () =>
      new Request('https://example.test/api/webhook/telegram', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': 'Secret_Webhook_Token_2026',
        },
        body: JSON.stringify(payload),
      });

    const res1 = await telegramWebhookPost(makeReq());
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.ok, true);
    assert.equal(body1.outcome, 'DELIVERED');
    assert.equal(mockAudits.length, 2);
    assert.equal(sentTelegramMessages.length, 1);
    assert.equal(sentTelegramMessages[0].includes('849201'), false);
    assert.equal(sentTelegramMessages[0].includes('INV-TELE-001'), true);

    // Replay same update_id
    const res2 = await telegramWebhookPost(makeReq());
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.duplicate, true);
    assert.equal(mockAudits.length, 2);
    assert.equal(sentTelegramMessages.length, 1);
  });

  it('keeps DB commit intact when Telegram confirmation send fails and deduplicates retry', async () => {
    failTelegramSend = true;
    const payload = {
      update_id: 9002,
      message: {
        chat: { id: 7694473069, type: 'private' },
        from: { id: 7694473069, is_bot: false },
        text: '/otp INV-TELE-001 #501 739104',
      },
    };
    const makeReq = () =>
      new Request('https://example.test/api/webhook/telegram', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': 'Secret_Webhook_Token_2026',
        },
        body: JSON.stringify(payload),
      });

    const res1 = await telegramWebhookPost(makeReq());
    assert.equal(res1.status, 200);
    assert.equal(mockAudits.length, 2);
    assert.equal(mockReceipts.has('9002'), true);

    failTelegramSend = false;
    const res2 = await telegramWebhookPost(makeReq());
    const body2 = await res2.json();
    assert.equal(body2.duplicate, true);
    assert.equal(mockAudits.length, 2);
  });

  it('returns 500 on temporary database failure so Telegram can retry', async () => {
    failDb = true;
    const req = new Request('https://example.test/api/webhook/telegram', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'Secret_Webhook_Token_2026',
      },
      body: JSON.stringify({
        update_id: 9003,
        message: {
          chat: { id: 7694473069, type: 'private' },
          from: { id: 7694473069, is_bot: false },
          text: '/otp INV-TELE-001 #501 739104',
        },
      }),
    });
    const res = await telegramWebhookPost(req);
    assert.equal(res.status, 500);
  });
});
