import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

// Query-aware transaction fake: no database, provider or customer data.
let store, locked, beforeLock, failAudit;
function assertParentLock(model, where) {
  if (model === 'order' || model === 'orderSecret' || model === 'robloxOrderDetail') {
    assert.deepEqual(locked, { table: 'Order', id: where.id ?? where.orderId }, 'write requires the exact Order lock');
  } else if (model === 'checkoutSession') {
    assert.deepEqual(locked, { table: 'CheckoutSession', id: where.id }, 'delete requires the exact Session lock');
  } else {
    const affected = rows(model).filter(row => matches(row, where));
    assert.equal(locked?.table, 'CheckoutSession');
    assert.ok(affected.every(row => row.sessionId === locked.id), 'attempt deletion requires its own parent Session lock');
  }
}
function matches(row, where) {
  return Object.entries(where ?? {}).every(([key, value]) => {
    if (key === 'AND') return value.every(part => matches(row, part));
    if (key === 'OR') return value.some(part => matches(row, part));
    if (value === null || typeof value !== 'object' || value instanceof Date) return row?.[key] === value;
    return Object.entries(value).every(([op, operand]) => {
      const actual = row?.[key];
      if (op === 'in') return operand.includes(actual);
      if (op === 'not') return actual !== operand;
      if (op === 'lte') return actual !== null && actual <= operand;
      if (op === 'lt') return actual !== null && actual < operand;
      if (op === 'gt') return actual !== null && actual > operand;
      if (op === 'none') return actual.every(child => !matches(child, operand));
      if (op === 'some') return actual.some(child => matches(child, operand));
      if (op === 'is') return actual !== null && matches(actual, operand);
      return matches(actual, { [op]: operand });
    });
  });
}
function rows(model) {
  if (model === 'checkoutSession') return store.sessions.map(s => ({ ...s, attempts: rows('checkoutAttempt').filter(a => a.sessionId === s.id) }));
  if (model === 'checkoutAttempt') return store.attempts.map(a => ({ ...a, order: store.orders.find(o => o.id === a.orderId) ?? null }));
  if (model === 'robloxOrderDetail') return store.details.map(d => ({ ...d, order: store.orders.find(o => o.id === d.orderId) }));
  return store[model === 'order' ? 'orders' : 'secrets'];
}
const collection = { order: 'orders', orderSecret: 'secrets', checkoutSession: 'sessions', checkoutAttempt: 'attempts', robloxOrderDetail: 'details' };
const db = {
  $queryRaw: async (sql, id) => {
    if (sql.join('').includes('CURRENT_TIMESTAMP')) return [{ now: new Date() }];
    locked = { table: sql.join('').match(/FROM\s+`?(\w+)`?/)[1], id };
    if (beforeLock) { const action = beforeLock; beforeLock = null; action(id); } return [];
  },
  adminAudit: { create: async ({ data }) => { if (failAudit) throw new Error('AUDIT_UNAVAILABLE'); store.audits.push(data); } },
  rateLimit: { deleteMany: async () => ({ count: 0 }) },
  adminSession: { deleteMany: async () => ({ count: 0 }), findUnique: async () => ({ id: 'synthetic-admin', expiresAt: new Date(Date.now() + 60_000) }) },
  workerHeartbeat: { findUnique: async () => null },
  $transaction: async work => {
    const snapshot = structuredClone(store); locked = false;
    try { return await work(db); } catch (error) { store = snapshot; throw error; } finally { locked = false; }
  },
};
for (const model of Object.keys(collection)) db[model] = {
  count: async ({ where }) => rows(model).filter(row => matches(row, where)).length,
  findMany: async ({ where, take, orderBy }) => {
    let result = rows(model).filter(row => matches(row, where));
    if (orderBy) { const key = Object.keys(orderBy)[0]; result = result.sort((a, b) => a[key] - b[key]); }
    return structuredClone(result.slice(0, take));
  },
  findUnique: async ({ where, include }) => {
    const row = rows(model).find(row => matches(row, where));
    if (row && model === 'order' && include?.checkoutAttempt) return structuredClone({ ...row, checkoutAttempt: store.attempts.find(a => a.orderId === row.id) ?? null });
    return structuredClone(row ?? null);
  },
  update: async ({ where, data }) => { assertParentLock(model, where); const row = store[collection[model]].find(r => matches(r, where)); Object.assign(row, data); return row; },
  updateMany: async ({ where, data }) => {
    assertParentLock(model, where);
    const ids = rows(model).filter(r => matches(r, where)).map(r => r.id ?? r.orderId);
    for (const row of store[collection[model]]) if (ids.includes(row.id ?? row.orderId)) Object.assign(row, data);
    return { count: ids.length };
  },
  deleteMany: async ({ where }) => {
    assertParentLock(model, where);
    const victims = rows(model).filter(r => matches(r, where));
    if (model === 'checkoutSession') assert.ok(victims.every(s => !store.attempts.some(a => a.sessionId === s.id)), 'FK Restrict');
    store[collection[model]] = store[collection[model]].filter(r => !victims.some(v => (v.id ?? v.orderId) === (r.id ?? r.orderId)));
    return { count: victims.length };
  },
};
globalThis.prisma = db;
const { purgeExpiredSecrets } = await import('../src/lib/fulfillmentWorker.ts');
const cleaner = await import('../src/lib/stockCleaner.ts');
const { applyPaymentStatus } = await import('../src/lib/payments.ts');
test.after(() => { delete globalThis.prisma; });
test.beforeEach(() => { store = { orders: [], secrets: [], details: [], sessions: [], attempts: [], audits: [] }; beforeLock = null; failAudit = false; });
const past = () => new Date(Date.now() - 60_000), future = () => new Date(Date.now() + 60_000);
function order(status = 'PAID', fulfillmentStatus = 'PROCESSING') {
  const row = { id: store.orders.length + 1, status, fulfillmentStatus, refundStatus: 'NONE', archivedAt: null, removedFromAdminAt: null,
    type: 'ROBLOX', invoice: 'INV-SYNTHETIC', totalAmount: 1000, currency: 'IDR', pricingRegion: 'ID', paymentProvider: 'MIDTRANS', paymentReference: 'fixture-reference', expiresAt: past(), accountStockId: null };
  store.orders.push(row); return row;
}
for (const [status, fulfillment, expected] of [
  ['PENDING', 'NOT_READY', 'NOT_READY'], ['PAID', 'PROCESSING', 'REQUIRES_REVIEW'], ['EXPIRED', 'NOT_READY', 'NOT_READY'],
  ['CANCELLED', 'NOT_READY', 'NOT_READY'], ['PAID', 'COMPLETED', 'COMPLETED'], ['PAID', 'REQUIRES_REVIEW', 'REQUIRES_REVIEW'],
]) test(`expired secret cleanup preserves ${status}/${fulfillment} and is idempotent`, async () => {
  const row = order(status, fulfillment); store.secrets.push({ orderId: row.id, expiresAt: past() });
  assert.equal(await purgeExpiredSecrets(), 1); assert.equal(store.secrets.length, 0);
  assert.equal(row.status, status); assert.equal(row.fulfillmentStatus, expected);
  const audits = store.audits.length; assert.equal(await purgeExpiredSecrets(), 0); assert.equal(store.audits.length, audits);
});
test('secret cleanup rechecks completion after waiting and rolls back audit failure', async () => {
  const row = order(); store.secrets.push({ orderId: row.id, expiresAt: past() });
  beforeLock = () => { row.fulfillmentStatus = 'COMPLETED'; };
  await purgeExpiredSecrets(); assert.equal(row.fulfillmentStatus, 'COMPLETED');
  row.fulfillmentStatus = 'PROCESSING'; store.secrets.push({ orderId: row.id, expiresAt: past() }); failAudit = true;
  await assert.rejects(purgeExpiredSecrets(), /AUDIT_UNAVAILABLE/);
  assert.equal(store.secrets.length, 1); assert.equal(store.orders[0].fulfillmentStatus, 'PROCESSING');
});
test('renewed secrets and refunded/archived work are not moved into review', async () => {
  const row = order(); store.secrets.push({ orderId: row.id, expiresAt: past() });
  beforeLock = () => { store.secrets[0].expiresAt = future(); };
  assert.equal(await purgeExpiredSecrets(), 0); assert.equal(store.secrets.length, 1);
  for (const patch of [{ refundStatus: 'COMPLETED' }, { archivedAt: new Date() }, { removedFromAdminAt: new Date() }]) {
    Object.assign(row, { refundStatus: 'NONE', archivedAt: null, removedFromAdminAt: null }, patch); store.secrets[0].expiresAt = past();
    await purgeExpiredSecrets(); assert.equal(row.fulfillmentStatus, 'PROCESSING');
    store.secrets.push({ orderId: row.id, expiresAt: past() });
  }
});
test('expired checkout cleanup retains invoice access, active leases and pending recovery', async () => {
  const pending = order('PENDING'), paid = order();
  store.sessions = ['expired', 'invoice', 'lease', 'pending', 'fresh-attempt'].map(id => ({ id, expiresAt: id === 'invoice' ? future() : past(), revokedAt: null }));
  store.attempts = store.sessions.map((s, i) => ({ id: i + 1, sessionId: s.id, state: i === 0 ? 'READY' : 'COMMITTED', expiresAt: i === 4 ? future() : past(),
    leaseUntil: i === 2 ? future() : null, orderId: i === 3 ? pending.id : i === 0 ? null : paid.id }));
  const history = structuredClone(store.orders);
  const result = await cleaner.cleanupCheckoutSessions();
  assert.deepEqual(result, { sessions: 1, attempts: 1 });
  assert.deepEqual(store.sessions.map(s => s.id), ['invoice', 'lease', 'pending', 'fresh-attempt']);
  assert.deepEqual(store.orders, history);
  assert.deepEqual(await cleaner.cleanupCheckoutSessions(), { sessions: 0, attempts: 0 });
});
test('checkout cleanup batches attempts before removing their expired session', async () => {
  store.sessions = [{ id: 'expired', expiresAt: past() }];
  store.attempts = Array.from({ length: 105 }, (_, id) => ({ id, sessionId: 'expired', orderId: null, expiresAt: past(), leaseUntil: null, state: 'EXPIRED' }));
  assert.deepEqual(await cleaner.cleanupCheckoutSessions(), { sessions: 0, attempts: 100 });
  assert.equal(store.sessions.length, 1);
  assert.deepEqual(await cleaner.cleanupCheckoutSessions(), { sessions: 1, attempts: 5 });
});
test('checkout cleanup rechecks lease and expiry after the session lock', async () => {
  for (const change of [() => { store.attempts[0].leaseUntil = future(); }, () => { store.attempts[0].expiresAt = future(); }, () => { store.sessions[0].expiresAt = future(); }]) {
    store.sessions = [{ id: 'expired', expiresAt: past() }];
    store.attempts = [{ id: 1, sessionId: 'expired', orderId: null, expiresAt: past(), leaseUntil: null, state: 'PROCESSING' }];
    beforeLock = change;
    assert.deepEqual(await cleaner.cleanupCheckoutSessions(), { sessions: 0, attempts: 0 });
    assert.equal(store.attempts.length, 1);
  }
});
test('existing cleanup cron path preserves committed identity and removes unused sessions and unpaid contacts', async () => {
  const paid = order(), cancelled = order('CANCELLED');
  store.sessions = [{ id: 'expired-paid', expiresAt: past() }, { id: 'expired-unused', expiresAt: past() }];
  store.attempts = [{ id: 1, sessionId: 'expired-paid', orderId: paid.id, expiresAt: past(), leaseUntil: null, state: 'COMMITTED' },
    { id: 2, sessionId: 'expired-unused', orderId: null, expiresAt: past(), leaseUntil: null, state: 'EXPIRED' }];
  store.details.push({ orderId: cancelled.id, method: 'LOGIN', whatsappE164: 'synthetic-encrypted-contact' });
  const history = structuredClone(store.orders);
  assert.equal(await cleaner.releaseExpiredOrders(), 0);
  assert.deepEqual(store.sessions.map(s => s.id), ['expired-paid']); assert.deepEqual(store.attempts.map(a => a.id), [1]);
  assert.equal(store.details[0].whatsappE164, null); assert.deepEqual(store.orders, history);
});
test('expired-session cleanup cannot turn a committed Login into a legacy bearer replay', async () => {
  process.env.CHECKOUT_HASH_KEY = 'synthetic-cleanup-hash';
  const row = order(); row.checkoutKey = 'synthetic-cleanup-order-key-123456789';
  store.sessions = [{ id: 'expired', expiresAt: past() }];
  store.attempts = [{ id: 1, sessionId: 'expired', orderId: row.id, expiresAt: past(), leaseUntil: null, state: 'COMMITTED' }];
  const { checkoutInput, requestDigest } = await import('../src/lib/commerce.ts');
  const { createCheckout } = await import('../src/lib/checkout.ts');
  const body = { productId: 1, customerEmail: 'synthetic@example.invalid', details: {} };
  row.requestHash = requestDigest(checkoutInput(body));
  await assert.rejects(createCheckout(body, row.checkoutKey), /CHECKOUT_SESSION_REQUIRED/);
  await cleaner.cleanupCheckoutSessions();
  await assert.rejects(createCheckout(body, row.checkoutKey), /CHECKOUT_SESSION_REQUIRED/);
  assert.equal(store.attempts.length, 1); assert.equal(store.orders.length, 1);
});
test('expired unused attempts are cleaned beside permanent committed markers and active leases', async () => {
  const paid = order(); store.sessions = [{ id: 'expired', expiresAt: past() }];
  store.attempts = [
    { id: 1, sessionId: 'expired', orderId: paid.id, expiresAt: past(), leaseUntil: null, state: 'COMMITTED' },
    { id: 2, sessionId: 'expired', orderId: null, expiresAt: past(), leaseUntil: null, state: 'EXPIRED' },
    { id: 3, sessionId: 'expired', orderId: null, expiresAt: past(), leaseUntil: future(), state: 'PROCESSING' },
  ];
  assert.deepEqual(await cleaner.cleanupCheckoutSessions(), { sessions: 0, attempts: 1 });
  assert.deepEqual(store.attempts.map(a => a.id), [1, 3]);
  assert.deepEqual(await cleaner.cleanupCheckoutSessions(), { sessions: 0, attempts: 0 });
});
test('payment cancellation erases WhatsApp atomically; late payment stays in refund review', async () => {
  const row = order('PENDING', 'NOT_READY'); store.details.push({ orderId: row.id, method: 'LOGIN', whatsappE164: 'synthetic-encrypted-contact' });
  const payment = { provider: 'MIDTRANS', region: 'ID', invoice: row.invoice, amount: row.totalAmount, currency: 'IDR', reference: row.paymentReference, state: 'failed', cancelled: true };
  await applyPaymentStatus(row.id, payment); assert.equal(store.details[0].whatsappE164, null); assert.equal(row.status, 'CANCELLED');
  await applyPaymentStatus(row.id, { ...payment, state: 'paid' });
  assert.equal(row.status, 'PAID'); assert.equal(row.fulfillmentStatus, 'REQUIRES_REVIEW'); assert.equal(row.refundStatus, 'REQUIRED');
  assert.equal(store.details[0].whatsappE164, null);
});
test('expiry erases contact and contact write failure rolls the payment transition back', async () => {
  const row = order('PENDING', 'NOT_READY'); store.details.push({ orderId: row.id, method: 'LOGIN', whatsappE164: 'synthetic-encrypted-contact' });
  const original = db.robloxOrderDetail.updateMany;
  db.robloxOrderDetail.updateMany = async () => { throw new Error('CONTACT_WRITE_FAILED'); };
  try { await assert.rejects(applyPaymentStatus(row.id, null, new Date()), /CONTACT_WRITE_FAILED/); }
  finally { db.robloxOrderDetail.updateMany = original; }
  assert.equal(store.orders[0].status, 'PENDING'); assert.equal(store.details[0].whatsappE164, 'synthetic-encrypted-contact');
  await applyPaymentStatus(row.id, null, new Date());
  assert.equal(store.orders[0].status, 'EXPIRED'); assert.equal(store.details[0].whatsappE164, null);
});
test('cron removes old unpaid contacts while preserving pending, paid and completed fulfillment', async () => {
  for (const status of ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED']) { const row = order(status); store.details.push({ orderId: row.id, method: 'LOGIN', whatsappE164: 'synthetic-encrypted-contact' }); }
  await cleaner.purgeUnpaidLoginContacts();
  assert.deepEqual(store.details.map(d => d.whatsappE164), ['synthetic-encrypted-contact', 'synthetic-encrypted-contact', null, null]);
  await cleaner.purgeUnpaidLoginContacts(); assert.equal(store.orders.length, 4);
});
test('contact backfill rechecks late payment after acquiring Order lock', async () => {
  const row = order('EXPIRED'); store.details.push({ orderId: row.id, method: 'LOGIN', whatsappE164: 'synthetic-encrypted-contact' });
  beforeLock = () => { row.status = 'PAID'; };
  await cleaner.purgeUnpaidLoginContacts(); assert.equal(store.details[0].whatsappE164, 'synthetic-encrypted-contact');
});
test('actual fulfillment handler reviewCount excludes unpaid, archived and refunded-complete work', async () => {
  // Supply an empty cookie jar only; exercise the actual bearer/session guard and handler.
  const hook = registerHooks({ resolve(specifier, context, next) {
    if (specifier === 'next/headers') return { url: 'data:text/javascript,export async function cookies(){return {get(){return undefined}}}', shortCircuit: true };
    return next(specifier, context);
  } });
  try {
    const { GET } = await import('../src/app/api/admin/fulfillment/route.ts');
    for (const status of ['PENDING', 'EXPIRED', 'CANCELLED', 'PAID']) order(status, 'REQUIRES_REVIEW');
    Object.assign(order('PAID', 'REQUIRES_REVIEW'), { refundStatus: 'REQUIRED' });
    Object.assign(order('PAID', 'REQUIRES_REVIEW'), { refundStatus: 'COMPLETED' });
    Object.assign(order('PAID', 'REQUIRES_REVIEW'), { archivedAt: new Date() });
    Object.assign(order('PAID', 'REQUIRES_REVIEW'), { removedFromAdminAt: new Date() });
    const endpoint = 'https://store.invalid/api/admin/fulfillment';
    assert.equal((await GET(new Request(endpoint))).status, 401);
    const response = await GET(new Request(endpoint, { headers: { Authorization: 'Bearer ' + 'A'.repeat(43) } }));
    assert.equal(response.status, 200); assert.equal((await response.json()).monitoring.reviewCount, 2);
    const unpaid = await GET(new Request(endpoint + '?payment=PENDING', { headers: { Authorization: 'Bearer ' + 'A'.repeat(43) } }));
    assert.equal((await unpaid.json()).monitoring.reviewCount, 0);
  } finally { hook.deregister(); }
});
