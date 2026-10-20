import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTelegramNotificationOutcome } from '../src/lib/telegram.ts';

test('Telegram distinguishes explicit rejection from ambiguous send outcomes', async () => {
  const original = globalThis.fetch;
  const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN = 'synthetic'; process.env.TELEGRAM_ADMIN_CHAT_ID = 'synthetic';
  try {
    for (const [reply, expected] of [
      [() => Response.json({ ok: true }), 'SENT'],
      [() => Response.json({ ok: false, error_code: 400 }, { status: 400 }), 'REJECTED'],
      [() => new Response('Bad Gateway', { status: 502 }), 'UNKNOWN'],
      [() => Response.json({ ok: false, error_code: 429 }, { status: 429 }), 'UNKNOWN'],
      [() => Response.json({ ok: false }), 'UNKNOWN'],
      [() => new Response('x'.repeat(16385)), 'UNKNOWN'],
      [() => { throw new Error('simulated timeout'); }, 'UNKNOWN'],
    ]) { globalThis.fetch = async () => reply(); assert.equal(await sendTelegramNotificationOutcome('fixture'), expected); }
  } finally {
    globalThis.fetch = original;
    if (token === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = token;
    if (chat === undefined) delete process.env.TELEGRAM_ADMIN_CHAT_ID; else process.env.TELEGRAM_ADMIN_CHAT_ID = chat;
  }
});
