import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ENCRYPTION_KEY = 'isolated-apps-checkout-key';
process.env.MIDTRANS_SERVER_KEY = 'isolated-apps-checkout-midtrans';
delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_ADMIN_CHAT_ID;
let stored, product, stockLocks, jobs;
const config = { version: 1, appGroup: 'capcut', accountType: 'Private', durationDays: 7, devices: 'one', regionRules: 'ID', usageRules: 'rules', included: 'access', instructions: 'guide', warrantyDays: 7, warrantyTerms: 'terms', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' };
const tx = {
  $queryRaw: async () => [],
  product: { findUnique: async () => structuredClone(product) },
  order: {
    findFirst: async () => null,
    findUnique: async ({ where }) => where.id || stored?.checkoutKey === where.checkoutKey ? stored : null,
    create: async ({ data }) => { stored = { id: 10, ...data, status: 'PENDING', fulfillmentStatus: 'NOT_READY', refundStatus: 'NONE', paymentReference: null, appsService: data.appsService?.create }; return stored; },
    update: async ({ data }) => Object.assign(stored, data),
    updateMany: async ({ data }) => { Object.assign(stored, data); return { count: 1 }; },
  },
  accountStock: { findFirst: async () => ({ id: 9 }), updateMany: async () => { stockLocks++; return { count: 1 }; } },
  appsService: { update: async ({ data }) => Object.assign(stored.appsService, data) },
  fulfillmentJob: { upsert: async () => { jobs++; } },
};
globalThis.prisma = { ...tx, $transaction: async fn => fn(tx) };
const { createCheckout } = await import('../src/lib/checkout.ts');
const { requestDigest } = await import('../src/lib/commerce.ts');
const { applyPaymentStatus } = await import('../src/lib/payments.ts');
function reset(mode = 'ACTIVATION') {
  stored = null; stockLocks = 0; jobs = 0;
  product = { id: 1, active: true, type: 'APPS', name: 'Synthetic package', price: 1000, variants: [], appsConfig: mode ? { ...config, fulfillmentMode: mode, activationMethod: mode === 'ACTIVATION' ? 'INVITATION' : null } : null };
}
function body() { return { productId: 1, customerEmail: 'fixture@example.test', ...(product.appsConfig ? { appsPolicyToken: requestDigest({ productId: 1, price: product.price, appsConfig: product.appsConfig }) } : {}) }; }
const paid = () => ({ state: 'paid', provider: 'MIDTRANS', region: 'ID', invoice: stored.invoice, amount: 1000, currency: 'IDR', reference: 'synthetic-reference' });

test('terms drift blocks commit; purchase snapshot survives later product changes', async () => {
  reset(); const prior = body(); product.appsConfig.warrantyDays = 5;
  await assert.rejects(createCheckout(prior, 'x'.repeat(32), 'ID'), /APPS_TERMS_CHANGED/);
  assert.equal(stored, null);
  await createCheckout(body(), 'y'.repeat(32), 'ID'); product.appsConfig.warrantyDays = 2;
  assert.equal(stored.appsSnapshot.warrantyDays, 5);
});
test('activation never reserves stock or completes on payment; duplicate settlement creates no second job', async () => {
  reset(); await createCheckout(body(), 'a'.repeat(32), 'ID');
  assert.equal(stored.accountStockId, null); assert.equal(stockLocks, 0);
  await applyPaymentStatus(10, paid());
  assert.equal(stored.fulfillmentStatus, 'QUEUED'); assert.equal(jobs, 1);
  await applyPaymentStatus(10, paid()); assert.equal(jobs, 1);
});
test('configured ready-account and legacy Apps retain stock reservation and completion', async () => {
  for (const mode of ['READY_ACCOUNT', null]) {
    reset(mode); await createCheckout(body(), 'b'.repeat(32), 'ID');
    assert.equal(stored.accountStockId, 9); await applyPaymentStatus(10, paid());
    assert.equal(stockLocks, 2); assert.equal(stored.fulfillmentStatus, 'COMPLETED'); assert.equal(jobs, 0);
  }
});
test('renewal binds to the same authorized product/customer and rejects a different source', async () => {
  reset(); const old = { id: 5, productId: 2, type: 'APPS', status: 'PAID', refundStatus: 'NONE', customerEmail: 'other@example.test', appsSnapshot: config, appsService: { activeFrom: new Date() } };
  stored = old;
  await assert.rejects(createCheckout(body(), 'r'.repeat(32), 'ID', undefined, false, old.id), /PRODUCT_UNAVAILABLE/);
});

test('new Apps purchases and renewals require Indonesia before reserving stock or creating an order', async () => {
  for (const mode of ['READY_ACCOUNT', 'ACTIVATION', null]) for (const region of [null, 'MY', 'PH']) {
    reset(mode);
    await assert.rejects(createCheckout(body(), 'n'.repeat(32), region),
      region === null ? /REGION_UNVERIFIED/ : /PAYMENT_REGION_UNAVAILABLE/);
    assert.equal(stored, null); assert.equal(stockLocks, 0); assert.equal(jobs, 0);
  }
  reset();
  stored = { id: 5, productId: 1, type: 'APPS', status: 'PAID', refundStatus: 'NONE', customerEmail: 'fixture@example.test', appsSnapshot: config, appsService: { activeFrom: new Date() } };
  const source = stored;
  await assert.rejects(createCheckout(body(), 'r'.repeat(32), null, undefined, false, source.id), /REGION_UNVERIFIED/);
  assert.equal(stored, source);
  await createCheckout(body(), 'r'.repeat(32), 'ID', undefined, false, source.id);
  assert.equal(stored.appsService.renewalOfOrderId, source.id);
});

test('an existing Apps invoice remains recoverable after location changes without another stock lock', async () => {
  reset('READY_ACCOUNT'); const input = body(); const key = 'i'.repeat(32);
  const first = await createCheckout(input, key, 'ID');
  for (const region of [null, 'MY', 'PH']) {
    const replay = await createCheckout(input, key, region);
    assert.equal(replay.created, false); assert.equal(replay.order.invoice, first.order.invoice);
  }
  assert.equal(stockLocks, 1);
});
