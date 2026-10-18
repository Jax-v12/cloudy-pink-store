import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTelegramOtpCommand } from '../src/lib/telegramWebhook.ts';

describe('telegramWebhook', () => {
  it('parses direct command /otp <invoice> <code>', () => {
    const res = parseTelegramOtpCommand('/otp INV-20261018-001 482910');
    assert.deepEqual(res, {
      invoice: 'INV-20261018-001',
      code: '482910',
    });
  });

  it('parses reply to Telegram message containing invoice', () => {
    const replyText = '🚨 *Permintaan Kode OTP / TV Masuk!*\nInvoice: INV-20261018-ABC\nProduk: Netflix Premium\n...';

    // With /otp prefix
    const res1 = parseTelegramOtpCommand('/otp 918234', replyText);
    assert.deepEqual(res1, {
      invoice: 'INV-20261018-ABC',
      code: '918234',
    });

    // Without /otp prefix (just the code)
    const res2 = parseTelegramOtpCommand('918234', replyText);
    assert.deepEqual(res2, {
      invoice: 'INV-20261018-ABC',
      code: '918234',
    });
  });

  it('rejects invalid or malformed commands', () => {
    assert.equal(parseTelegramOtpCommand(''), null);
    assert.equal(parseTelegramOtpCommand('/help'), null);
    assert.equal(parseTelegramOtpCommand('/otp 12'), null); // too short code
    assert.equal(parseTelegramOtpCommand('/otp'), null);
    assert.equal(parseTelegramOtpCommand(null), null);
    assert.equal(parseTelegramOtpCommand('hello world', 'no invoice here'), null);
  });
});
