// Disposable local fixtures only. No provider or outbound network is permitted.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const target = new URL(process.env.TEST_DATABASE_URL || 'invalid:');
assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
assert.equal(target.pathname, '/cloudy_test_benchmark_20261019');
process.env.DATABASE_URL = target.href;
process.env.ENCRYPTION_KEY = 'isolated-apps-integration-encryption';
process.env.CHECKOUT_HASH_KEY = 'isolated-apps-integration-hmac';
process.env.TELEGRAM_BOT_TOKEN = ''; process.env.TELEGRAM_ADMIN_CHAT_ID = '';
globalThis.fetch = async () => { throw new Error('OUTBOUND_NETWORK_FORBIDDEN'); };
const { prisma } = await import('../src/lib/prisma.ts');
const { createCheckout } = await import('../src/lib/checkout.ts');
const { applyPaymentStatus } = await import('../src/lib/payments.ts');
const { requestDigest } = await import('../src/lib/commerce.ts');
const { appsOrderAction, purgeAppsDeliveries } = await import('../src/lib/appsService.ts');
const { encryptData } = await import('../src/lib/crypto.ts');
const cfg = { version: 1, appGroup: 'synthetic', accountType: 'Private', durationDays: 7, devices: 'fixture', regionRules: 'ID', usageRules: 'fixture', included: 'fixture', instructions: 'fixture', warrantyDays: 7, warrantyTerms: 'fixture', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' };
let checks = 0;
async function check(name, work) { await work(); checks++; console.log(`PASS ${name}`); }
const key = () => crypto.randomUUID();
const session = await prisma.adminSession.create({ data: { tokenHash: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date() } });
const secondSession = await prisma.adminSession.create({ data: { tokenHash: crypto.randomBytes(32).toString('hex'), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date() } });
const product = await prisma.product.create({ data: { name: 'BENCH synthetic activation', slug: 'bench-' + key(), type: 'APPS', price: 1000, appsConfig: cfg } });
const policy = () => requestDigest({ productId: product.id, price: product.price, appsConfig: cfg });
const input = () => ({ productId: product.id, customerEmail: 'fixture@example.test', appsPolicyToken: policy() });
let order;
try {
  await check('atomic activation checkout without stock', async () => {
    order = (await createCheckout(input(), key())).order;
    assert.equal(order.accountStockId, null); assert.equal(order.appsSnapshot.warrantyDays, 7);
    assert.ok(await prisma.appsService.findUnique({ where: { orderId: order.id } }));
  });
  await check('policy change rejects stale confirmation and preserves earlier order snapshot', async () => {
    await prisma.product.update({ where: { id: product.id }, data: { appsConfig: { ...cfg, warrantyDays: 6 } } });
    await assert.rejects(createCheckout(input(), key()), /APPS_TERMS_CHANGED/);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).appsSnapshot.warrantyDays, 7);
    await prisma.product.update({ where: { id: product.id }, data: { appsConfig: cfg } });
  });
  await check('duplicate verified settlement queues exactly one activation job', async () => {
    const status = { state: 'paid', provider: 'MIDTRANS', region: 'ID', invoice: order.invoice, amount: 1000, currency: 'IDR', reference: 'bench-' + key() };
    await Promise.all([applyPaymentStatus(order.id, status), applyPaymentStatus(order.id, status)]);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'QUEUED');
    assert.equal(await prisma.fulfillmentJob.count({ where: { orderId: order.id } }), 1);
  });
  await check('claim ownership, delivery acknowledgment and evidence-gated completion', async () => {
    await appsOrderAction(order.id, { action: 'claim', sessionId: session.id });
    await assert.rejects(appsOrderAction(order.id, { action: 'claim', sessionId: secondSession.id }), /JOB_BUSY/);
    await appsOrderAction(order.id, { action: 'deliver', sessionId: session.id, delivery: 'Synthetic invitation sent' });
    await appsOrderAction(order.id, { action: 'acknowledge' });
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'WAITING_CUSTOMER');
    await assert.rejects(appsOrderAction(order.id, { action: 'complete', sessionId: session.id }), /INVALID_INPUT/);
    await appsOrderAction(order.id, { action: 'complete', sessionId: session.id, evidence: 'BENCH-ACTIVATION' });
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'COMPLETED');
  });
  await check('support transitions and audited reopening do not redeliver or change payment', async () => {
    await appsOrderAction(order.id, { action: 'support', reason: 'NO_ACCESS' });
    await appsOrderAction(order.id, { action: 'support-status', sessionId: session.id, supportStatus: 'IN_PROGRESS' });
    await appsOrderAction(order.id, { action: 'support-status', sessionId: session.id, supportStatus: 'RESOLVED' });
    await appsOrderAction(order.id, { action: 'support', reason: 'STOPPED_WORKING' });
    assert.equal((await prisma.appsSupport.findUnique({ where: { orderId: order.id } })).status, 'OPEN');
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, 'PAID');
  });
  await check('distinct-key renewals serialize, same-key replay recovers one successor', async () => {
    const keys = [key(), key()];
    const outcomes = await Promise.allSettled(keys.map(k => createCheckout(input(), k, null, undefined, false, order.id)));
    assert.equal(outcomes.filter(r => r.status === 'fulfilled').length, 1);
    const index = outcomes.findIndex(r => r.status === 'fulfilled'); const renewal = outcomes[index].value.order;
    assert.equal(outcomes.find(r => r.status === 'rejected').reason.code, 'RENEWAL_EXISTS');
    assert.equal((await createCheckout(input(), keys[index], null, undefined, false, order.id)).order.id, renewal.id);
    const status = { state: 'paid', provider: 'MIDTRANS', region: 'ID', invoice: renewal.invoice, amount: 1000, currency: 'IDR', reference: 'bench-' + key() };
    await applyPaymentStatus(renewal.id, status);
    await appsOrderAction(renewal.id, { action: 'claim', sessionId: session.id });
    await appsOrderAction(renewal.id, { action: 'deliver', sessionId: session.id, delivery: 'Synthetic renewal' });
    await appsOrderAction(renewal.id, { action: 'complete', sessionId: session.id, evidence: 'BENCH-RENEWAL' });
    const [prior, next] = await Promise.all([prisma.appsService.findUnique({ where: { orderId: order.id } }), prisma.appsService.findUnique({ where: { orderId: renewal.id } })]);
    assert.equal(next.activeFrom.getTime(), prior.activeUntil.getTime());
    assert.equal(next.activeUntil - next.activeFrom, 7 * 86400000);
  });
  await check('expired delivery ciphertext is physically purged while financial history survives', async () => {
    await prisma.appsService.update({ where: { orderId: order.id }, data: { deliveredAt: new Date(Date.now() - 73 * 3600000) } });
    assert.equal(await purgeAppsDeliveries(), 1);
    assert.equal((await prisma.appsService.findUnique({ where: { orderId: order.id } })).deliveryCiphertext, null);
    assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, 'PAID');
    assert.equal(await purgeAppsDeliveries(), 0);
  });
  await check('legacy account delivery remains encrypted and completes with real stock locks', async () => {
    const p = await prisma.product.create({ data: { name: 'BENCH legacy account', slug: 'bench-' + key(), price: 1000, stocks: { create: { emailAccount: encryptData('fixture@example.test'), passwordAccount: encryptData('synthetic-password') } } } });
    const legacy = (await createCheckout({ productId: p.id, customerEmail: 'fixture@example.test' }, key())).order;
    await applyPaymentStatus(legacy.id, { state: 'paid', provider: 'MIDTRANS', region: 'ID', invoice: legacy.invoice, amount: 1000, currency: 'IDR', reference: 'bench-' + key() });
    assert.equal((await prisma.order.findUnique({ where: { id: legacy.id } })).fulfillmentStatus, 'COMPLETED');
    assert.equal((await prisma.accountStock.findUnique({ where: { id: legacy.accountStockId } })).status, 'SOLD');
  });
  await check('fully refunded unactivated renewal permits a replacement successor', async () => {
    const source = (await createCheckout(input(), key())).order;
    await applyPaymentStatus(source.id, { state: 'paid', provider: 'MIDTRANS', region: 'ID', invoice: source.invoice, amount: 1000, currency: 'IDR', reference: 'bench-' + key() });
    // Synthetic previous service entitlement; no real provider/refund call.
    await prisma.appsService.update({ where: { orderId: source.id }, data: { activeFrom: new Date(), activeUntil: new Date(Date.now() + 86400000) } });
    const failedRenewal = (await createCheckout(input(), key(), null, undefined, false, source.id)).order;
    await applyPaymentStatus(failedRenewal.id, { state: 'paid', provider: 'MIDTRANS', region: 'ID', invoice: failedRenewal.invoice, amount: 1000, currency: 'IDR', reference: 'bench-' + key() });
    await prisma.order.update({ where: { id: failedRenewal.id }, data: { refundStatus: 'COMPLETED', fulfillmentStatus: 'REQUIRES_REVIEW' } });
    const replacement = (await createCheckout(input(), key(), null, undefined, false, source.id)).order;
    assert.notEqual(replacement.id, failedRenewal.id);
    assert.equal((await prisma.appsService.findUnique({ where: { orderId: replacement.id } })).renewalOfOrderId, source.id);
  });
  console.log(`MySQL Apps integration: ${checks} PASS; no provider calls`);
} finally { await prisma.$disconnect(); }
