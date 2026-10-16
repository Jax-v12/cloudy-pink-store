import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutInput, parseDetails, requestDigest } from '../src/lib/commerce.ts';
import { encryptData } from '../src/lib/crypto.ts';

// Synthetic credentials only. Never send these fixtures to Roblox or a provider.
const credentials = { password: '  fixture-password-only  ', backupCodes: ['fixture-01', 'fixture-02', 'fixture-03', 'fixture-04', 'fixture-05'] };
const details = () => ({ username: 'FixtureUser', whatsappE164: '+12133734253', ...structuredClone(credentials) });
process.env.ENCRYPTION_KEY = 'synthetic-login-access-encryption';
process.env.CHECKOUT_HASH_KEY = 'synthetic-login-access-hash';
let state, failAudit;
const db = {
  $queryRaw: async () => [],
  order: { findUnique: async () => state.order, update: async ({ data }) => Object.assign(state.order, data) },
  adminSession: { findUnique: async ({ where }) => where.id === state.session.id ? state.session : null },
  orderSecret: { deleteMany: async () => { const count = Number(Boolean(state.order.secret)); state.order.secret = null; return { count }; } },
  robloxOrderDetail: { updateMany: async ({ where, data }) => {
    if (where.method !== state.order.robloxDetail?.method) return { count: 0 };
    Object.assign(state.order.robloxDetail, data); return { count: 1 };
  } },
  adminAudit: { create: async ({ data }) => { if (failAudit) throw new Error('SYNTHETIC_AUDIT_FAILURE'); state.audits.push(data); return data; } },
  fulfillmentJob: { update: async ({ data }) => Object.assign(state.order.job, data) },
  $transaction: async callback => { const before = structuredClone(state); try { return await callback(db); } catch (error) { state = before; throw error; } },
};
globalThis.prisma = db;
const reveal = async (sessionId = 'admin-owner') => (await import('../src/lib/loginAccess.ts')).revealLoginAccess(1, sessionId);
test.after(() => { delete globalThis.prisma; });
test.beforeEach(() => {
  failAudit = false;
  state = { session: { id: 'admin-owner', expiresAt: new Date(Date.now() + 3600_000), reauthenticatedAt: new Date() }, audits: [], order: {
    id: 1, invoice: 'INV-SYNTHETIC', createdAt: new Date(), type: 'ROBLOX', status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: 'PROCESSING', archivedAt: null, removedFromAdminAt: null,
    robloxDetail: { method: 'LOGIN', username: 'FixtureUser' }, job: { ownerSessionId: 'admin-owner', completedAt: null },
    secret: { ciphertext: encryptData(JSON.stringify({ version: 1, invoice: 'INV-SYNTHETIC', username: 'FixtureUser', ...credentials })), expiresAt: new Date(Date.now() + 3600_000) },
  } };
});

test('manual completion deletes the same encrypted secret with the delivery audit', async () => {
  const { manualAction } = await import('../src/lib/manualFulfillment.ts');
  failAudit = true; await assert.rejects(manualAction(1, 'admin-owner', 'complete', 'synthetic-delivery-reference'), /SYNTHETIC_AUDIT_FAILURE/);
  assert.ok(state.order.secret); assert.equal(state.order.fulfillmentStatus, 'PROCESSING');
  failAudit = false; await manualAction(1, 'admin-owner', 'complete', 'synthetic-delivery-reference');
  assert.equal(state.order.secret, null); assert.equal(state.order.fulfillmentStatus, 'COMPLETED');
  assert.equal(state.audits[0].action, 'complete'); assert.ok(state.order.job.completedAt);
});

test('provider-confirmed cancellation and failure delete Login secrets atomically', async () => {
  const { applyPaymentStatus } = await import('../src/lib/payments.ts');
  db.order.updateMany = async ({ where, data }) => {
    if (state.order.status !== where.status) return { count: 0 };
    Object.assign(state.order, data); return { count: 1 };
  };
  const original = structuredClone(state);
  for (const cancelled of [true, false]) {
    state = structuredClone(original);
    Object.assign(state.order, { status: 'PENDING', totalAmount: 7500, currency: 'IDR', pricingRegion: 'ID', paymentProvider: 'MIDTRANS', paymentReference: 'fixture-provider-reference', accountStockId: null });
    await applyPaymentStatus(1, { state: 'failed', cancelled, invoice: state.order.invoice, amount: 7500, currency: 'IDR', region: 'ID', provider: 'MIDTRANS', reference: 'fixture-provider-reference' });
    assert.equal(state.order.secret, null); assert.equal(state.order.status, cancelled ? 'CANCELLED' : 'EXPIRED');
  }
});

test('only Login accepts the complete bounded password and five distinct backup codes', () => {
  const parsed = parseDetails('ROBLOX', { method: 'LOGIN' }, details());
  assert.deepEqual(parsed.loginCredentials, credentials);
  assert.equal('password' in parsed.roblox, false); assert.equal('backupCodes' in parsed.roblox, false);
  for (const method of ['GAMEPASS', 'GIFT_USERNAME']) assert.throws(() => parseDetails('ROBLOX', { method, units: 100 }, details()));
  assert.throws(() => parseDetails('APPS', null, details()));
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { username: 'FixtureUser', whatsappE164: '+12133734253' }), /LOGIN_ACCESS_REQUIRED/);
  for (const change of [{ password: '' }, { password: ' '.repeat(3) }, { password: 'x'.repeat(1025) }, { backupCodes: ['a'] }, { backupCodes: Array(5).fill('same-code') }, { backupCodes: ['a','b','c','d','x'.repeat(65)] }, { backupCodes: ['a','b','c','d',42] }]) {
    assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { ...details(), ...change }));
  }
});

test('checkout preserves password bytes, normalizes backup edges, and binds secrets in a keyed digest', () => {
  const input = checkoutInput({ productId: 1, variantId: 2, customerEmail: 'fixture@example.invalid', details: { ...details(), backupCodes: credentials.backupCodes.map(code => ' ' + code + ' ') } });
  assert.equal(input.details.password, credentials.password); assert.deepEqual(input.details.backupCodes, credentials.backupCodes);
  assert.notEqual(requestDigest(input), requestDigest({ ...input, details: { ...input.details, password: 'different-fixture' } }));
  assert.notEqual(requestDigest(input), requestDigest({ ...input, details: { ...input.details, backupCodes: ['different', ...credentials.backupCodes.slice(1)] } }));
  assert.deepEqual(checkoutInput({ productId: 1, customerEmail: 'fixture@example.invalid', details: { username: 'FixtureUser' } }).details, { username: 'FixtureUser' });
  for (const field of ['otp', 'sessionCookie', 'sessionToken', 'robloxPassword', 'recoveryCode']) assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { ...details(), [field]: 'synthetic-denied' }));
});

test('paid claimed Login access returns credentials only after a metadata audit, bounded to sixty seconds', async () => {
  const before = Date.now(); const result = await reveal();
  assert.equal(result.username, 'FixtureUser'); assert.equal(result.password, credentials.password); assert.deepEqual(result.backupCodes, credentials.backupCodes);
  assert.ok(new Date(result.displayUntil).getTime() <= Date.now() + 60_000); assert.ok(new Date(result.displayUntil).getTime() >= before);
  assert.equal(state.audits.length, 1); assert.equal(state.audits[0].action, 'login-access-reveal');
  const audit = JSON.stringify(state.audits); for (const secret of [credentials.password, ...credentials.backupCodes]) assert.equal(audit.includes(secret), false);
  assert.ok(state.order.secret);
});

test('unpaid, foreign-owner, other method, refunded, archived, completed and missing orders fail closed', async () => {
  const original = structuredClone(state);
  const cases = [
    order => { order.status = 'PENDING'; }, order => { order.type = 'APPS'; }, order => { order.robloxDetail.method = 'GAMEPASS'; },
    order => { order.refundStatus = 'REQUIRED'; }, order => { order.job.ownerSessionId = 'other-admin'; }, order => { order.job.completedAt = new Date(); },
    order => { order.fulfillmentStatus = 'COMPLETED'; }, order => { order.archivedAt = new Date(); }, order => { order.removedFromAdminAt = new Date(); },
    order => { order.secret = null; }, order => { order.job = null; },
  ];
  for (const mutate of cases) {
    state = structuredClone(original); mutate(state.order);
    // Access checks must precede any attempt to decrypt even a corrupt value.
    if (state.order.secret) state.order.secret.ciphertext = 'invalid';
    await assert.rejects(reveal(), /LOGIN_ACCESS_UNAVAILABLE/); assert.equal(state.audits.length, 0);
  }
  state = structuredClone(original); state.order = null; await assert.rejects(reveal(), /LOGIN_ACCESS_UNAVAILABLE/);
});

test('reauthentication and live session expiry are checked again under the order lock', async () => {
  for (const mutate of [session => { session.expiresAt = new Date(0); }, session => { session.reauthenticatedAt = new Date(Date.now() - 300_001); }, session => { session.reauthenticatedAt = null; }]) {
    const previous = structuredClone(state); mutate(state.session); await assert.rejects(reveal(), /UNAUTHORIZED|REAUTH_REQUIRED/); assert.equal(state.audits.length, 0); state = previous;
  }
  await assert.rejects(reveal('other-admin'), /UNAUTHORIZED/);
  state.session.reauthenticatedAt = new Date(Date.now() - 299_000);
  assert.ok(new Date((await reveal()).displayUntil).getTime() <= state.session.reauthenticatedAt.getTime() + 300_000);
});

test('expired credentials are deleted atomically with review status; an audit failure rolls back', async () => {
  state.order.secret.expiresAt = new Date(0); failAudit = true;
  await assert.rejects(reveal(), /SYNTHETIC_AUDIT_FAILURE/); assert.ok(state.order.secret); assert.equal(state.order.fulfillmentStatus, 'PROCESSING');
  failAudit = false; await assert.rejects(reveal(), /LOGIN_ACCESS_UNAVAILABLE/);
  assert.equal(state.order.secret, null); assert.equal(state.order.fulfillmentStatus, 'REQUIRES_REVIEW'); assert.equal(state.audits[0].action, 'login-access-expired');
});

test('a later secret expiry cannot extend the absolute 72-hour lifetime from order creation', async () => {
  state.order.createdAt = new Date(Date.now() - 259_200_001);
  state.order.secret.expiresAt = new Date(Date.now() + 3600_000);
  failAudit = true;
  await assert.rejects(reveal(), /SYNTHETIC_AUDIT_FAILURE/);
  assert.ok(state.order.secret); assert.equal(state.order.fulfillmentStatus, 'PROCESSING');
  failAudit = false;
  await assert.rejects(reveal(), /LOGIN_ACCESS_UNAVAILABLE/);
  assert.equal(state.order.secret, null);
  assert.equal(state.order.fulfillmentStatus, 'REQUIRES_REVIEW');
  assert.equal(state.audits[0].action, 'login-access-expired');
});

test('the admin display deadline cannot cross the absolute order lifetime', async () => {
  state.order.createdAt = new Date(Date.now() - 259_200_000 + 10_000);
  state.order.secret.expiresAt = new Date(Date.now() + 3600_000);
  const result = await reveal();
  assert.ok(new Date(result.displayUntil).getTime() <= state.order.createdAt.getTime() + 259_200_000);
});

test('new 72-hour access survives the former 24-hour boundary without renewing legacy expiry', async () => {
  const createdAt = Date.now() - 25 * 3600_000;
  state.order.createdAt = new Date(createdAt);
  state.order.secret.expiresAt = new Date(createdAt + 72 * 3600_000);
  assert.equal((await reveal()).username, 'FixtureUser');
  state.order.secret.expiresAt = new Date(createdAt + 24 * 3600_000);
  await assert.rejects(reveal(), /LOGIN_ACCESS_UNAVAILABLE/);
  assert.equal(state.order.secret, null);
});

test('corruption, cross-order envelope substitution and failed auditing never return plaintext', async () => {
  const original = state.order.secret.ciphertext;
  state.order.secret.ciphertext = 'invalid'; await assert.rejects(reveal()); assert.equal(state.audits.length, 0);
  state.order.secret.ciphertext = original; state.order.invoice = 'INV-OTHER'; await assert.rejects(reveal()); assert.equal(state.audits.length, 0);
  state.order.invoice = 'INV-SYNTHETIC'; failAudit = true; await assert.rejects(reveal(), /SYNTHETIC_AUDIT_FAILURE/); assert.equal(state.audits.length, 0);
});

test('maximum-length Unicode input fits the bounded encrypted access envelope', async () => {
  const password = String.fromCharCode(0xd800).repeat(1024);
  const backupCodes = Array.from({ length: 5 }, (_, index) => String(index) + String.fromCharCode(0xd800).repeat(63));
  state.order.secret.ciphertext = encryptData(JSON.stringify({ version: 1, invoice: state.order.invoice, username: 'FixtureUser', password, backupCodes }));
  assert.ok(state.order.secret.ciphertext.length > 8192);
  const result = await reveal(); assert.equal(result.password.length, 1024); assert.equal(result.backupCodes.length, 5);
});
