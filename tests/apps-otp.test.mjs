import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  OTP_REPLY_PREFIX,
  OTP_REQUEST_ACTION,
  OTP_TTL_MS,
  validateOtpCode,
  encodeOtpReplyAction,
  parseOtpReplyAction,
  resolveAppsOtpState,
  buildAppsOtpWhatsappUrl,
} from '../src/lib/appsOtp.ts';
import { requestAppsOtp, replyAppsOtp } from '../src/lib/appsOtpServer.ts';

process.env.ENCRYPTION_KEY ||= 'test-encryption-key-32-bytes-minimum';

let mockOrders = new Map();
let mockAudits = [];
let mockReceipts = new Map();
let nextAuditId = 100;
let txTail = Promise.resolve();

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

const mockTx = {
  $queryRaw: async (_strings, ...values) => {
    const id = Number(values[0]);
    const order = mockOrders.get(id);
    return order ? [structuredClone(order)] : [];
  },
  adminAudit: {
    findFirst: async ({ where }) => {
      const matched = mockAudits
        .filter((a) => matchesOtpAuditWhere(a, where))
        .sort((a, b) => b.id - a.id);
      if (matched.length === 0) return null;
      const top = matched[0];
      return { id: top.id, orderId: top.orderId, action: top.action, createdAt: top.createdAt };
    },
    create: async ({ data }) => {
      const entry = {
        id: ++nextAuditId,
        orderId: data.orderId,
        sessionId: data.sessionId,
        action: data.action,
        createdAt: new Date(),
      };
      mockAudits.push(entry);
      return { id: entry.id, action: entry.action, createdAt: entry.createdAt };
    },
  },
  telegramUpdateReceipt: {
    findUnique: async ({ where }) => {
      const found = mockReceipts.get(String(where.updateId));
      return found ? structuredClone(found) : null;
    },
    create: async ({ data }) => {
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
};

const runMockMutation = async (_op, work) => {
  const previous = txTail;
  let release;
  txTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await work(mockTx);
  } finally {
    release();
  }
};

describe('appsOtp pure helpers', () => {
  before(() => {
    process.env.ENCRYPTION_KEY ||= 'test-encryption-key-32-bytes-minimum';
  });

  it('validates OTP / Household codes strictly', () => {
    assert.equal(validateOtpCode(' 482910 '), '482910');
    assert.equal(validateOtpCode('NF-1234 56'), 'NF-1234 56');
    assert.equal(validateOtpCode('12'), null);
    assert.equal(validateOtpCode('a'.repeat(25)), null);
    assert.equal(validateOtpCode('1234\n56'), null);
    assert.equal(validateOtpCode(123456), null);
  });

  it('encodes encrypted OTP reply with requestId under VARCHAR(191) and resolves state transitions deterministically', () => {
    const t0 = new Date('2026-10-18T10:00:00.000Z');
    const t1 = new Date('2026-10-18T10:01:00.000Z');
    const replyAction = encodeOtpReplyAction('849201', 42);
    assert.equal(replyAction.length <= 191, true);
    assert.equal(replyAction.includes('849201'), false);

    const parsed = parseOtpReplyAction(replyAction);
    assert.equal(parsed?.requestId, 42);

    // 1. IDLE when no audits
    assert.deepEqual(resolveAppsOtpState([], true, t0.getTime()), {
      status: 'IDLE',
      requestId: null,
      code: null,
      updatedAt: null,
      expiresAt: null,
    });

    // 2. REQUESTED when customer requested within TTL
    const requested = resolveAppsOtpState(
      [{ id: 42, action: OTP_REQUEST_ACTION, createdAt: t0 }],
      true,
      t0.getTime() + 30_000,
    );
    assert.equal(requested.status, 'REQUESTED');
    assert.equal(requested.requestId, 42);
    assert.equal(requested.code, null);

    // 3. DELIVERED when admin replied after request (even if createdAt millisecond is identical, higher id wins)
    const deliveredSameTimestamp = resolveAppsOtpState(
      [
        { id: 42, action: OTP_REQUEST_ACTION, createdAt: t0 },
        { id: 43, action: replyAction, createdAt: t0 },
      ],
      true,
      t0.getTime() + 10_000,
    );
    assert.equal(deliveredSameTimestamp.status, 'DELIVERED');
    assert.equal(deliveredSameTimestamp.requestId, 42);
    assert.equal(deliveredSameTimestamp.code, '849201');

    // 4. Admin list view omits decrypted plaintext code
    const deliveredAdminList = resolveAppsOtpState(
      [{ id: 43, action: replyAction, createdAt: t1 }],
      false,
      t1.getTime() + 10_000,
    );
    assert.equal(deliveredAdminList.status, 'DELIVERED');
    assert.equal(deliveredAdminList.requestId, 42);
    assert.equal(deliveredAdminList.code, null);

    // 5. Expires back to IDLE at exact boundary now >= expiresAt
    const exactBoundary = resolveAppsOtpState(
      [{ id: 43, action: replyAction, createdAt: t1 }],
      true,
      t1.getTime() + OTP_TTL_MS,
    );
    assert.equal(exactBoundary.status, 'IDLE');
    assert.equal(exactBoundary.requestId, null);
    assert.equal(exactBoundary.code, null);
  });

  it('builds pre-formatted WhatsApp URL with invoice and profile without credentials', () => {
    const url = buildAppsOtpWhatsappUrl(
      '6287867395872',
      'INV-998877',
      'Netflix Premium 1 Bulan',
      'Profil 2',
      'Halo Admin, saya butuh kode OTP untuk {product} dengan Invoice: {invoice}',
    );
    assert.equal(url.startsWith('https://wa.me/6287867395872?text='), true);
    const decoded = decodeURIComponent(url.split('?text=')[1]);
    assert.equal(
      decoded,
      'Halo Admin, saya butuh kode OTP untuk Netflix Premium 1 Bulan (Profil 2) dengan Invoice: INV-998877',
    );
  });
});

describe('appsOtpServer transactional guarantees', () => {
  beforeEach(() => {
    mockOrders = new Map();
    mockAudits = [];
    mockReceipts = new Map();
    nextAuditId = 100;

    mockOrders.set(1, {
      id: 1,
      invoice: 'INV-APPS-001',
      totalAmount: 35000,
      type: 'APPS',
      status: 'PAID',
      accountStockId: 10,
      removedFromAdminAt: null,
      refundStatus: 'NONE',
    });
  });

  it('deduplicates concurrent customer OTP requests under lock', async () => {
    const [r1, r2] = await Promise.all([
      requestAppsOtp(1, () => Date.now(), runMockMutation),
      requestAppsOtp(1, () => Date.now(), runMockMutation),
    ]);
    const createdCount = [r1, r2].filter((r) => r.created).length;
    assert.equal(createdCount, 1);
    assert.equal(r1.state.requestId, r2.state.requestId);
    assert.equal(mockAudits.length, 1);
  });

  it('rejects non-eligible orders (ROBLOX, refunded, removed, or missing accountStockId)', async () => {
    mockOrders.set(2, {
      id: 2,
      invoice: 'INV-ROBLOX-002',
      totalAmount: 10000,
      type: 'ROBLOX',
      status: 'PAID',
      accountStockId: null,
      removedFromAdminAt: null,
      refundStatus: 'NONE',
    });
    await assert.rejects(
      requestAppsOtp(2, () => Date.now(), runMockMutation),
      (err) => err.code === 'ORDER_NOT_FOUND' && err.status === 404,
    );

    mockOrders.set(3, {
      id: 3,
      invoice: 'INV-REFUND-003',
      totalAmount: 25000,
      type: 'APPS',
      status: 'PAID',
      accountStockId: 11,
      removedFromAdminAt: null,
      refundStatus: 'COMPLETED',
    });
    await assert.rejects(
      requestAppsOtp(3, () => Date.now(), runMockMutation),
      (err) => err.code === 'ORDER_NOT_FOUND' && err.status === 404,
    );
  });

  it('enforces requestId correlation and prevents duplicate or stale replies', async () => {
    // Reply when no request exists returns REQUEST_NOT_FOUND
    const notFoundReply = await replyAppsOtp({
      orderId: 1,
      requestId: 999,
      code: '123456',
      sessionId: 'sess-valid',
      runMutation: runMockMutation,
    });
    assert.equal(notFoundReply.outcome, 'REQUEST_NOT_FOUND');

    // Create first request
    const req1 = await requestAppsOtp(1, () => Date.now(), runMockMutation);
    const req1Id = req1.state.requestId;

    // Concurrent replies for req1Id: first delivers, second is ALREADY_DELIVERED without extra audit
    const [rep1, rep2] = await Promise.all([
      replyAppsOtp({
        orderId: 1,
        requestId: req1Id,
        code: '654321',
        sessionId: 'sess-valid',
        runMutation: runMockMutation,
      }),
      replyAppsOtp({
        orderId: 1,
        requestId: req1Id,
        code: '654321',
        sessionId: 'sess-valid',
        runMutation: runMockMutation,
      }),
    ]);
    assert.equal([rep1, rep2].filter((r) => r.outcome === 'DELIVERED').length, 1);
    assert.equal([rep1, rep2].filter((r) => r.outcome === 'ALREADY_DELIVERED').length, 1);
    assert.equal(mockAudits.length, 2);
    assert.equal(mockAudits[1].sessionId, 'sess-valid');

    // Customer creates a second OTP request (superseding req1Id)
    const req2 = await requestAppsOtp(1, () => Date.now(), runMockMutation);
    const req2Id = req2.state.requestId;
    assert.notEqual(req2Id, req1Id);

    // Replying to the old req1Id now returns REQUEST_SUPERSEDED without writing a reply audit
    const superseded = await replyAppsOtp({
      orderId: 1,
      requestId: req1Id,
      code: '111222',
      sessionId: 'sess-valid',
      runMutation: runMockMutation,
    });
    assert.equal(superseded.outcome, 'REQUEST_SUPERSEDED');
    assert.equal(mockAudits.length, 3); // req1, rep1, req2

    // Replying after OTP_TTL_MS returns REQUEST_EXPIRED
    const expired = await replyAppsOtp({
      orderId: 1,
      requestId: req2Id,
      code: '333444',
      sessionId: 'sess-valid',
      now: () => Date.now() + OTP_TTL_MS + 1000,
      runMutation: runMockMutation,
    });
    assert.equal(expired.outcome, 'REQUEST_EXPIRED');
    assert.equal(mockAudits.length, 3);
  });

  it('records Telegram update receipt atomically and deduplicates replayed update_id', async () => {
    const reqRes = await requestAppsOtp(1, () => Date.now(), runMockMutation);
    const requestId = reqRes.state.requestId;

    const first = await replyAppsOtp({
      invoice: 'INV-APPS-001',
      requestId,
      code: '778899',
      telegramUpdateId: 50001,
      sessionId: 'telegram:7694473069',
      runMutation: runMockMutation,
    });
    assert.equal(first.outcome, 'DELIVERED');
    assert.equal(mockReceipts.has('50001'), true);
    assert.equal(mockAudits[1].sessionId, 'telegram:7694473069');

    // Replay same update_id
    const replay = await replyAppsOtp({
      invoice: 'INV-APPS-001',
      requestId,
      code: '778899',
      telegramUpdateId: 50001,
      sessionId: 'telegram:7694473069',
      runMutation: runMockMutation,
    });
    assert.equal(replay.outcome, 'DUPLICATE_UPDATE');
    assert.equal(mockAudits.length, 2);
  });
});
