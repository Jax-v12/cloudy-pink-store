import { sameOrigin } from '../src/lib/csrf.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptData, decryptData } from '../src/lib/crypto.ts';
import { checkoutInput, parseDetails, requestDigest, checkoutEnabled } from '../src/lib/commerce.ts';
import { verifySignature, getGatewayStatus } from '../src/lib/midtrans.ts';
import { getGameProvider } from '../src/lib/gameProvider.ts';

process.env.ENCRYPTION_KEY = 'isolated-test-encryption-key';
process.env.MIDTRANS_SERVER_KEY = 'isolated-test-midtrans-key';
test('authenticated encryption protects password and all five backup codes', () => {
  const value = JSON.stringify({ password: 'secret', backupCodes: ['1111','2222','3333','4444','5555'] });
  const encrypted = encryptData(value);
  assert.equal(decryptData(encrypted), value);
  assert.notEqual(encryptData(value), encrypted);
  const parts = encrypted.split(':'); parts[1] = '0'.repeat(32);
  assert.throws(() => decryptData(parts.join(':')));
});
test('strict category fields and Gamepass URL validation', () => {
  assert.throws(() => checkoutInput({ productId: 1, customerEmail: 'a@b.c', totalAmount: 1 }));
  assert.throws(() => parseDetails('APPS', null, { password: 'secret' }));
  for (const gamepassUrl of ['https://roblox.com.evil.test/game-pass/1','http://roblox.com/game-pass/1','https://roblox.com@evil.test/game-pass/1','https://roblox.com/game-pass/1?redirect=evil','https://127.0.0.1/game-pass/1']) {
    assert.throws(() => parseDetails('ROBLOX', { method: 'GAMEPASS', gamepassPrice: 150 }, { username: 'customer', gamepassUrl }));
  }
  const details = parseDetails('ROBLOX', { method: 'GAMEPASS', gamepassPrice: 150 }, { username: 'customer', gamepassUrl: 'https://www.roblox.com/game-pass/123/example' });
  assert.equal(details.roblox.gamepassPrice, 150);
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { username: 'customer', password: 'x', backupCodes: ['1111','1111','1111','1111','1111'] }));
  assert.throws(() => parseDetails('GAME', { requiresZone: true, providerSku: 'x' }, { userId: '123' }));
});
test('canonical request digest is stable and binds credentials', () => {
  assert.equal(requestDigest({ a: 1, b: 2 }), requestDigest({ b: 2, a: 1 }));
  assert.notEqual(requestDigest({ password: 'a' }), requestDigest({ password: 'b' }));
});
test('SHA-512 signature and database amount validation are maintained', async () => {
  const body = { order_id: 'INV-test', status_code: '200', gross_amount: '1000.00' };
  body.signature_key = crypto.createHash('sha512').update(body.order_id + body.status_code + body.gross_amount + process.env.MIDTRANS_SERVER_KEY).digest('hex');
  assert.equal(verifySignature(body), true);
  assert.equal(verifySignature({ ...body, gross_amount: '1.00' }), false);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ...body, currency: 'IDR', transaction_status: 'settlement' });
    await assert.rejects(getGatewayStatus('INV-test', 2000), /GATEWAY_STATUS_UNVERIFIED/);
  } finally { globalThis.fetch = original; }
});
test('simulator reconciles a timeout and production cannot enable it', async () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  const provider = getGameProvider('simulator');
  await assert.rejects(provider.send({ reference: 'timeout-1', sku: 'x', userId: '1', zoneId: null }));
  assert.equal((await provider.status('timeout-1')).outcome, 'succeeded');
  process.env.NODE_ENV = 'production'; process.env.GAME_PROVIDER = 'simulator';
  assert.equal(checkoutEnabled('GAME'), false);
  assert.throws(() => getGameProvider('simulator'));
  if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
});

test('CSRF uses browser Host and pins configured proxy origin', () => {
  const prior = process.env.APP_ORIGIN; delete process.env.APP_ORIGIN;
  const req = new Request('http://localhost:3107/api/admin', { headers: { Host: '127.0.0.1:3107', Origin: 'http://127.0.0.1:3107' } });
  assert.equal(sameOrigin(req), true);
  assert.equal(sameOrigin(new Request('http://localhost:3107', { headers: { Host: '127.0.0.1:3107', Origin: 'https://evil.example' } })), false);
  process.env.APP_ORIGIN = 'https://store.example.test';
  assert.equal(sameOrigin(req), false);
  assert.equal(sameOrigin(new Request('http://localhost', { headers: { Origin: 'https://store.example.test' } })), true);
  if (prior === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = prior;
});
