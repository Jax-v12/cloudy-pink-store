import test from 'node:test';
import assert from 'node:assert/strict';
import { getCountries, normalizeWhatsapp, validateLoginAccount } from '../src/lib/loginContact.ts';
import { checkoutInput, parseDetails, requestDigest } from '../src/lib/commerce.ts';
import { loginContactDto } from '../src/lib/loginContactDto.ts';
import { encryptData, decryptData } from '../src/lib/crypto.ts';
import { loginCredentialsFixture } from './login-access-fixture.mjs';

const phone = '+12133734253';
const account = { username: 'FixtureUser', email: 'fixture@example.invalid', country: 'US', whatsapp: '2133734253', ...loginCredentialsFixture() };
test('max metadata validates international countries independently of pricing', () => {
  assert.ok(getCountries().length > 200);
  assert.equal(normalizeWhatsapp(account.whatsapp, 'US'), phone);
  for (const value of ['+442079460018', '+6581234567', '+6281234567890', '+639171234567']) assert.equal(normalizeWhatsapp(value), value);
  for (const value of ['', '123', '+999123456789', '+1213', '+12133734253 ext 123', 'Call +12133734253', {}, '+000000000000000']) assert.equal(normalizeWhatsapp(value), null);
});
test('account validation reports each field and accepts international phone', () => {
  assert.deepEqual(validateLoginAccount(account), { username: false, email: false, whatsapp: false, password: false, backupCodes: false });
  assert.deepEqual(validateLoginAccount({ username: '!', email: 'invalid', country: '', whatsapp: '123', password: '', backupCodes: [] }), { username: true, email: true, whatsapp: true, password: true, backupCodes: true });
});
test('canonical phone enters checkout hash; missing legacy field stays absent', () => {
  process.env.CHECKOUT_HASH_KEY = 'synthetic-test-hash-key';
  const body = { productId: 1, customerEmail: 'fixture@example.invalid', details: { username: 'FixtureUser' } };
  const legacy = checkoutInput(body); assert.deepEqual(legacy.details, body.details);
  const first = checkoutInput({ ...body, details: { ...body.details, whatsappE164: '+1 (213) 373-4253' } });
  const second = checkoutInput({ ...body, details: { ...body.details, whatsappE164: phone } });
  assert.equal(first.details.whatsappE164, phone); assert.equal(requestDigest(first), requestDigest(second));
  assert.notEqual(requestDigest(first), requestDigest(legacy));
});
test('new Login requires contact and bounded account access without changing other methods', () => {
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { username: 'FixtureUser' }), /WHATSAPP_REQUIRED/);
  const parsed = parseDetails('ROBLOX', { method: 'LOGIN' }, { username: 'FixtureUser', whatsappE164: phone, ...loginCredentialsFixture() });
  assert.deepEqual(parsed.loginContact, { whatsappE164: phone }); assert.equal('whatsappE164' in parsed.roblox, false);
  assert.throws(() => parseDetails('ROBLOX', { method: 'GIFT_USERNAME' }, { username: 'FixtureUser', whatsappE164: phone }));
  assert.equal(parseDetails('ROBLOX', { method: 'GIFT_USERNAME' }, { username: 'FixtureUser' }).roblox.method, 'GIFT_USERNAME');
  assert.deepEqual(parseDetails('APPS', null, {}), {});
  for (const field of ['password','otp','sessionToken','backupCode','recoveryCode']) assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { username: 'FixtureUser', whatsappE164: phone, [field]: 'synthetic' }));
});
test('fulfillment projection strips ciphertext and decrypts only authorized Login contact', () => {
  process.env.ENCRYPTION_KEY = 'synthetic-test-encryption-key';
  const detail = { method: 'LOGIN', username: 'FixtureUser', whatsappE164: encryptData(phone) };
  assert.ok(detail.whatsappE164.length < 255); assert.notEqual(detail.whatsappE164, phone);
  assert.equal(loginContactDto(detail, true).contactWhatsapp, phone);
  const denied = loginContactDto(detail, false); assert.equal(denied.contactWhatsapp, null);
  assert.equal('whatsappE164' in denied.robloxDetail, false); assert.equal(JSON.stringify(denied).includes(phone), false);
  assert.equal(loginContactDto({ ...detail, method: 'GAMEPASS' }, true).contactWhatsapp, null);
  assert.equal(loginContactDto({ ...detail, whatsappE164: null }, true).contactWhatsapp, null);
  assert.equal(loginContactDto({ ...detail, whatsappE164: 'broken' }, false).contactWhatsapp, null);
  assert.throws(() => loginContactDto({ ...detail, whatsappE164: 'broken' }, true));
});
test('mocked checkout persists encrypted phone atomically; legacy replay never creates an order', async t => {
  process.env.ENCRYPTION_KEY = 'synthetic-test-encryption-key'; process.env.ROBLOX_CHECKOUT_ENABLED = 'true'; process.env.MIDTRANS_SERVER_KEY = 'synthetic-test-provider-key';
  const { checkoutPricing, checkoutQuoteToken } = await import('../src/lib/checkoutPricing.ts');
  const { mockRoblox } = await import('./roblox-fixture.mjs'); const restore = mockRoblox();
  const variant = { id: 2, productId: 1, active: true, method: 'LOGIN', units: 100, price: 7000, maxUnits: null, unitStep: 1, regionalPrices: [] };
  const product = { id: 1, active: true, type: 'ROBLOX', name: 'Fixture', price: 0, variants: [variant] };
  let created, transactions = 0, stored = null;
  globalThis.prisma = { order: { findUnique: async () => stored }, productVariant: { findFirst: async () => variant }, $transaction: async callback => { transactions++; return callback({ $queryRaw: async () => [], order: { findUnique: async () => stored, create: async ({ data }) => { created = data; return { id: 3, ...data }; } }, product: { findUnique: async () => product } }); } };
  const { createCheckout } = await import('../src/lib/checkout.ts');
  t.after(() => { delete globalThis.prisma; });
  try {
    const quoted = checkoutPricing('ROBLOX', 0, variant, 'ID', 'QRIS');
    const body = { productId: 1, variantId: 2, customerEmail: account.email, paymentMethod: 'QRIS', quoteToken: checkoutQuoteToken(1,2,quoted), details: { username: account.username, whatsappE164: phone, ...loginCredentialsFixture() } };
    const result = await createCheckout(body, 'a'.repeat(32), 'ID'); assert.equal(result.created, true); assert.equal(transactions, 1);
    assert.equal(decryptData(created.robloxDetail.create.whatsappE164), phone); assert.notEqual(created.robloxDetail.create.whatsappE164, phone);
    const storedAccess = JSON.parse(decryptData(created.secret.create.ciphertext));
    assert.equal(storedAccess.invoice, created.invoice); assert.equal(storedAccess.password, account.password); assert.deepEqual(storedAccess.backupCodes, account.backupCodes);
    assert.ok(created.secret.create.expiresAt.getTime() > Date.now() + 259_199_000);
    assert.ok(created.secret.create.expiresAt.getTime() <= Date.now() + 259_200_000);
    assert.equal(JSON.stringify(created).includes(account.password), false);
    const snapshot = created;
    await assert.rejects(createCheckout({ ...body, details: { username: account.username } }, 'c'.repeat(32), 'ID'), /WHATSAPP_REQUIRED/);
    assert.equal(created, snapshot); assert.equal(transactions, 1);
    delete process.env.ENCRYPTION_KEY;
    await assert.rejects(createCheckout(body, 'd'.repeat(32), 'ID'), /ENCRYPTION_KEY_REQUIRED/);
    assert.equal(created, snapshot);
    process.env.ENCRYPTION_KEY = 'synthetic-test-encryption-key';
    const legacy = { productId: 1, variantId: 2, customerEmail: account.email, details: { username: account.username } };
    stored = { id: 4, requestHash: requestDigest(checkoutInput(legacy)) };
    const beforeReplay = transactions;
    const replay = await createCheckout(legacy, 'b'.repeat(32)); assert.equal(replay.created, false); assert.equal(transactions, beforeReplay);
    await assert.rejects(createCheckout({ ...legacy, details: { username: account.username, whatsappE164: phone } }, 'b'.repeat(32)), /IDEMPOTENCY_CONFLICT/);
  } finally { restore(); }
});

test('committed Login replay precedes quote/region drift; absent commit rejects stale quote', async t => {
  process.env.ENCRYPTION_KEY = 'synthetic-test-encryption-key'; process.env.CHECKOUT_HASH_KEY = 'synthetic-test-hash-key';
  process.env.ROBLOX_CHECKOUT_ENABLED = 'true'; process.env.MIDTRANS_SERVER_KEY = 'synthetic-test-provider-key';
  const { checkoutPricing, checkoutQuoteToken } = await import('../src/lib/checkoutPricing.ts');
  const { mockRoblox } = await import('./roblox-fixture.mjs'); const restore = mockRoblox();
  const variant = { id: 2, productId: 1, active: true, method: 'LOGIN', units: 100, price: 7000, maxUnits: null, unitStep: 1, regionalPrices: [] };
  const product = { id: 1, active: true, type: 'ROBLOX', name: 'Fixture', price: 0, variants: [variant] };
  const stored = new Map(); let creates = 0, transactions = 0;
  const findOrder = async ({ where }) => stored.get(where.checkoutKey) ?? null;
  globalThis.prisma = { order: { findUnique: findOrder }, productVariant: { findFirst: async () => variant },
    $transaction: async callback => { transactions++; return callback({ $queryRaw: async () => [], order: {
      findUnique: findOrder, create: async ({ data }) => { creates++; const order = { id: creates, ...data }; stored.set(data.checkoutKey, order); return order; },
    }, product: { findUnique: async () => product } }); } };
  // checkout.ts retains the Prisma module binding from the preceding test.
  const { prisma } = await import('../src/lib/prisma.ts');
  const priorMock = { ...prisma }; Object.assign(prisma, globalThis.prisma);
  t.after(() => { Object.assign(prisma, priorMock); delete globalThis.prisma; restore(); });
  const { createCheckout } = await import('../src/lib/checkout.ts');
  const quote = checkoutPricing('ROBLOX', 0, variant, 'ID', 'QRIS');
  const original = { productId: 1, variantId: 2, customerEmail: account.email, paymentMethod: 'QRIS', quoteToken: checkoutQuoteToken(1, 2, quote),
    details: { username: account.username, whatsappE164: phone, ...loginCredentialsFixture() } };
  const key = 'replay-original-identity-000000000001';
  const first = await createCheckout(original, key, 'ID'); assert.equal(first.created, true); assert.equal(creates, 1);
  variant.price = 9000;
  const before = transactions;
  for (const region of [null, 'MY', 'ID']) {
    const replay = await createCheckout(original, key, region);
    assert.equal(replay.created, false); assert.equal(replay.order.invoice, first.order.invoice);
  }
  assert.equal(creates, 1); assert.equal(transactions, before);
  const freshQuote = checkoutQuoteToken(1, 2, checkoutPricing('ROBLOX', 0, variant, 'ID', 'QRIS'));
  await assert.rejects(createCheckout({ ...original, quoteToken: freshQuote }, key, 'ID'), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(createCheckout(original, 'absent-original-identity-000000000001', 'ID'), /PRICE_CHANGED/);
  assert.equal(creates, 1); assert.equal(stored.size, 1);
});
