import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { archiveEligibility } from '../src/lib/orderArchive.ts';
import { deletionEligibility } from '../src/lib/catalogLifecycle.ts';
import { adminMutation, adminMutationError, expectedTimestamp } from '../src/lib/adminMutation.ts';
import { commerceTranslations } from '../src/lib/commerceTranslations.ts';

test('archive policy fails closed for each obligation and unsupported type', () => {
  const final = { type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'COMPLETED', refundStatus: 'NONE', archivedAt: null,
    job: { completedAt: new Date(), leaseToken: null, leaseUntil: null }, secret: null, accountStock: null };
  assert.equal(archiveEligibility(final).canArchive, true);
  for (const patch of [
    { type: 'APPS' }, ...['PENDING','CANCELLED','EXPIRED'].map(status => ({ status })),
    ...['NOT_READY','QUEUED','PROCESSING','WAITING_CUSTOMER','REQUIRES_REVIEW'].map(fulfillmentStatus => ({ fulfillmentStatus })),
    { refundStatus: 'REQUIRED' }, { refundStatus: 'COMPLETED' }, { job: null },
    { job: { ...final.job, completedAt: null } }, { job: { ...final.job, leaseToken: 'uncertain' } },
    { job: { ...final.job, leaseUntil: new Date(Date.now() + 60000) } },
    { secret: { orderId: 1 } }, { accountStock: { status: 'LOCKED' } }, { archivedAt: new Date() },
  ]) assert.equal(archiveEligibility({ ...final, ...patch }).canArchive, false, JSON.stringify(patch));
  assert.deepEqual(deletionEligibility({ orders: 1, stocks: 1 }).reasonCodes, ['PRODUCT_HAS_ORDERS', 'PRODUCT_HAS_STOCK']);
  assert.equal(deletionEligibility({ orders: 0, stocks: 0 }).allowed, true);
  for (const value of [null, 1, 'invalid', '2026-02-30T00:00:00.000Z']) assert.throws(() => expectedTimestamp(value));
});

test('multilingual catalog and archive messages and reasons are defined for ID, EN, and MY', () => {
  const codes = [
    'deleteProduct', 'deactivateProduct', 'reactivateProduct', 'inactive', 'cancelAction',
    'deleteWarning', 'deleteBlocked', 'confirmProductName', 'adminPassword', 'reauthDelete',
    'archiveView', 'activeOrders', 'archivedOrders', 'archive', 'restore',
    'archiveWarning', 'archivedOn', 'archiveUnavailable', 'actionSaved',
    'UNAUTHORIZED', 'CSRF_REJECTED', 'REAUTH_REQUIRED', 'INVALID_CREDENTIALS', 'RATE_LIMIT_EXCEEDED',
    'INVALID_INPUT', 'SYSTEM_ERROR', 'DATABASE_UNAVAILABLE',
    'PRODUCT_CHANGED', 'PRODUCT_NOT_FOUND', 'PRODUCT_HAS_ORDERS', 'PRODUCT_HAS_STOCK', 'PRODUCT_HAS_DEPENDENCIES',
    'PRODUCT_TYPE_UNSUPPORTED', 'CONFIRMATION_MISMATCH',
    'ORDER_NOT_FOUND', 'ORDER_TYPE_UNSUPPORTED', 'ORDER_NOT_FINAL', 'ORDER_HAS_REFUND',
    'JOB_NOT_COMPLETE', 'JOB_BUSY', 'ORDER_HAS_OBLIGATIONS',
    'product-deleted', 'product-deactivated', 'product-reactivated',
  ];
  assert.equal(commerceTranslations.ID.actionSaved, 'Tersimpan.');
  assert.equal(commerceTranslations.EN.actionSaved, 'Saved.');
  assert.equal(commerceTranslations.MY.actionSaved, 'Disimpan.');
  for (const lang of ['ID', 'EN', 'MY']) {
    const dict = commerceTranslations[lang];
    assert.ok(dict, `Missing language dictionary: ${lang}`);
    for (const code of codes) {
      assert.equal(typeof dict[code], 'string', `Expected string for ${lang}.${code}`);
      assert.ok(dict[code].trim().length > 0, `Expected non-empty string for ${lang}.${code}`);
    }
  }
});

test('bounded retry and ambiguous failures never report success', async () => {
  let calls = 0;
  const original = prisma.$transaction;
  try {
  prisma.$transaction = async () => { calls++; if (calls === 1) throw { code: 'P2034' }; return 'committed'; };
  assert.equal(await adminMutation('test', async () => {}), 'committed'); assert.equal(calls, 2);
  for (const code of ['P2028', 'P1017']) {
    calls = 0; prisma.$transaction = async () => { calls++; throw { code }; };
    await assert.rejects(adminMutation('test', async () => {}), error => error.code === code);
    assert.equal(calls, 1); assert.equal(adminMutationError({ code }).status, 503);
  }
  calls = 0; prisma.$transaction = async () => { calls++; throw { code: 'P2034' }; };
  await assert.rejects(adminMutation('test', async () => {})); assert.equal(calls, 2);
  } finally { prisma.$transaction = original; }
});

const url = process.env.TEST_DATABASE_URL;
test('catalog and archive MySQL transactions, audit, races and rollback', { skip: !url }, async t => {
  const target = new URL(url);
  assert.ok(['127.0.0.1','localhost'].includes(target.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(target.pathname));
  // No Prisma call has opened a connection before selecting the isolated database.
  process.env.DATABASE_URL = url;
  process.env.ENCRYPTION_KEY = 'isolated-test'; process.env.ROBLOX_CHECKOUT_ENABLED = 'true';
  process.env.MIDTRANS_SERVER_KEY = 'isolated-test'; process.env.GAME_PROVIDER = 'simulator';
  delete process.env.TELEGRAM_BOT_TOKEN;
  const { prisma } = await import('../src/lib/prisma.ts');
  const { deleteCatalogProduct, setCatalogProductActive } = await import('../src/lib/catalogLifecycle.ts');
  const { setOrderArchived } = await import('../src/lib/orderArchive.ts');
  const { manualAction } = await import('../src/lib/manualFulfillment.ts');
  const { applyPaymentStatus } = await import('../src/lib/payments.ts');
  const { createCheckout: rawCheckout } = await import('../src/lib/checkout.ts');
  const { checkoutPricing, checkoutQuoteToken } = await import('../src/lib/checkoutPricing.ts');
  const { quotedCheckout } = await import('./checkout-fixture.mjs');
  const { mockRoblox } = await import('./roblox-fixture.mjs');
  const restoreRoblox = mockRoblox();
  const checkout = quotedCheckout(prisma, rawCheckout, checkoutPricing, checkoutQuoteToken);
  const session = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date() } });
  const other = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3600000) } });
  const product = (type = 'ROBLOX') => prisma.product.create({ data: { name: 'Archive fixture', slug: crypto.randomUUID(), type, price: 1000,
    variants: { create: { name: 'Login', method: 'LOGIN', price: 1000, units: 100, active: true, regionalPrices: { create: [{ region: 'MY', amount: 250, active: true }, { region: 'PH', amount: 3000, active: true }] } } } }, include: { variants: true } });
  const makeOrder = async (p, patch = {}) => prisma.order.create({ data: { product: { connect: { id: p.id } }, type: p.type, invoice: crypto.randomUUID(), customerEmail: 'fixture@example.test', totalAmount: 1000,
    expiresAt: new Date(Date.now() + 60000), status: 'PAID', fulfillmentStatus: 'COMPLETED', paymentReference: crypto.randomUUID(), job: { create: { completedAt: new Date() } }, ...patch } });
  const unchanged = order => Object.fromEntries(Object.entries(order).filter(([key]) => !['updatedAt', 'archivedAt'].includes(key)));
  try {
    await t.test('delete unused configurations and retain audit after product/session removal', async () => {
      const p = await product();
      const actor = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60000), reauthenticatedAt: new Date() } });
      await deleteCatalogProduct(p.id, actor.id, p.name, p.updatedAt);
      await prisma.adminSession.delete({ where: { id: actor.id } });
      assert.equal(await prisma.product.findUnique({ where: { id: p.id } }), null);
      assert.equal(await prisma.productVariant.count({ where: { productId: p.id } }), 0);
      assert.equal(await prisma.regionalPrice.count({ where: { variantId: p.variants[0].id } }), 0);
      const audit = await prisma.catalogAudit.findFirst({ where: { productId: p.id } });
      assert.equal(audit.action, 'product-deleted'); assert.equal(audit.sessionId, actor.id);
    });
    await t.test('all historical statuses block deletion, including archives', async () => {
      for (const status of ['PAID','PENDING','EXPIRED','CANCELLED']) {
        const p = await product(); const order = await makeOrder(p, { status });
        if (status === 'PAID') await setOrderArchived(order.id, session.id, true);
        await assert.rejects(deleteCatalogProduct(p.id, session.id, p.name, p.updatedAt), /PRODUCT_HAS_ORDERS/);
        assert.equal(await prisma.productVariant.count({ where: { productId: p.id } }), 1);
      }
    });
    await t.test('all stock states block endpoint and database-level deletion', async () => {
      for (const status of ['READY','LOCKED','SOLD']) {
        const p = await product();
        await prisma.accountStock.create({ data: { productId: p.id, emailAccount: 'encrypted-fixture', passwordAccount: 'encrypted-fixture', status } });
        await assert.rejects(deleteCatalogProduct(p.id, session.id, p.name, p.updatedAt), /PRODUCT_HAS_STOCK/);
        // Remove only the isolated product's configuration so the stock FK is the blocker.
        await prisma.productVariant.deleteMany({ where: { productId: p.id } });
        await assert.rejects(prisma.product.delete({ where: { id: p.id } }), error => error.code === 'P2003');
        assert.equal(await prisma.accountStock.count({ where: { productId: p.id } }), 1);
      }
    });
    await t.test('activation preserves regional configuration and repeated desired state is idempotent', async () => {
      const p = await product(); const before = await prisma.regionalPrice.findMany({ where: { variantId: p.variants[0].id } });
      const off = await setCatalogProductActive(p.id, session.id, false, p.updatedAt);
      assert.equal((await setCatalogProductActive(p.id, session.id, false, p.updatedAt)).changed, false);
      await setCatalogProductActive(p.id, session.id, true, off.updatedAt);
      assert.equal(await prisma.catalogAudit.count({ where: { productId: p.id } }), 2);
      assert.deepEqual(await prisma.regionalPrice.findMany({ where: { variantId: p.variants[0].id } }), before);
      await assert.rejects(deleteCatalogProduct(p.id, session.id, p.name, new Date(0)), /PRODUCT_CHANGED/);
      const latest = await prisma.product.findUnique({ where: { id: p.id } });
      await assert.rejects(deleteCatalogProduct(p.id, session.id, 'wrong', latest.updatedAt), /CONFIRMATION_MISMATCH/);
      await assert.rejects(deleteCatalogProduct(p.id, other.id, p.name, latest.updatedAt), /REAUTH_REQUIRED/);
    });
    await t.test('three Roblox methods and Game archive/restore keep snapshots and audit exactly once', async () => {
      for (const method of ['GAMEPASS','LOGIN','GIFT_USERNAME','GAME']) {
        const p = await product(method === 'GAME' ? 'GAME' : 'ROBLOX');
        const order = await makeOrder(p, method === 'GAME' ? {} : { robloxDetail: { create: { method, username: 'customer' } } });
        const results = await Promise.all([setOrderArchived(order.id, session.id, true), setOrderArchived(order.id, other.id, true)]);
        assert.equal(results.filter(r => r.changed).length, 1);
        assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id } }), 1);
        assert.deepEqual(unchanged(await prisma.order.findUnique({ where: { id: order.id } })), unchanged(order));
        await applyPaymentStatus(order.id, { provider: 'MIDTRANS', invoice: order.invoice, amount: order.totalAmount, currency: 'IDR', region: 'ID', reference: order.paymentReference, state: 'paid' });
        assert.equal(await prisma.fulfillmentJob.count({ where: { orderId: order.id } }), 1);
        assert.ok((await prisma.order.findUnique({ where: { id: order.id } })).archivedAt);
        const restored = await Promise.all([setOrderArchived(order.id, other.id, false), setOrderArchived(order.id, session.id, false)]);
        assert.equal(restored.filter(r => r.changed).length, 1);
        assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id } }), 2);
      }
    });
    await t.test('server rejects active, refund, secret, lease, missing-job and Apps orders', async () => {
      const p = await product();
      for (const patch of [
        { status: 'PENDING' }, ...['QUEUED','PROCESSING','WAITING_CUSTOMER','REQUIRES_REVIEW'].map(fulfillmentStatus => ({ fulfillmentStatus })),
        { refundStatus: 'REQUIRED' }, { refundStatus: 'COMPLETED' }, { job: undefined },
        { job: { create: {} } }, { job: { create: { completedAt: new Date(), leaseToken: 'unknown' } } },
        { job: { create: { completedAt: new Date(), leaseUntil: new Date(Date.now() + 60000) } } },
        { secret: { create: { ciphertext: 'encrypted-fixture', expiresAt: new Date() } } },
      ]) {
        const order = await makeOrder(p, patch); await assert.rejects(setOrderArchived(order.id, session.id, true));
        assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).archivedAt, null);
        assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id } }), 0);
      }
      const apps = await product('APPS'); const order = await makeOrder(apps);
      await assert.rejects(setOrderArchived(order.id, session.id, true), /ORDER_TYPE_UNSUPPORTED/);
      await assert.rejects(deleteCatalogProduct(apps.id, session.id, apps.name, apps.updatedAt), /PRODUCT_TYPE_UNSUPPORTED/);
      const lockedStock = await makeOrder(p, { accountStock: { create: { productId: p.id, emailAccount: 'encrypted-fixture', passwordAccount: 'encrypted-fixture', status: 'LOCKED' } } });
      await assert.rejects(setOrderArchived(lockedStock.id, session.id, true), /ORDER_HAS_OBLIGATIONS/);
    });
    await t.test('completion racing archive never hides unfinished work; competing archive/restore serialize', async () => {
      const p = await product(); const order = await makeOrder(p, { fulfillmentStatus: 'PROCESSING', job: { create: { ownerSessionId: session.id } } });
      await Promise.allSettled([manualAction(order.id, session.id, 'complete', 'receipt-fixture'), setOrderArchived(order.id, other.id, true)]);
      const current = await prisma.order.findUnique({ where: { id: order.id }, include: { job: true } });
      assert.equal(current.fulfillmentStatus, 'COMPLETED'); assert.ok(current.job.completedAt);
      await setOrderArchived(order.id, session.id, false);
      await Promise.all([setOrderArchived(order.id, session.id, true), setOrderArchived(order.id, other.id, false)]);
      const audits = await prisma.adminAudit.findMany({ where: { orderId: order.id, action: { in: ['archive','restore'] } }, orderBy: { id: 'desc' } });
      assert.equal(Boolean((await prisma.order.findUnique({ where: { id: order.id } })).archivedAt), audits[0].action === 'archive');
    });
    await t.test('checkout and deletion contend on the same product lock', async () => {
      for (let i = 0; i < 5; i++) {
        const p = await product();
        const body = { productId: p.id, variantId: p.variants[0].id, customerEmail: 'race@example.test', details: { username: 'customer' } };
        const results = await Promise.allSettled([checkout(body, crypto.randomUUID()), deleteCatalogProduct(p.id, session.id, p.name, p.updatedAt)]);
        const remaining = await prisma.product.findUnique({ where: { id: p.id } });
        const orders = await prisma.order.count({ where: { productId: p.id } });
        if (!remaining) { assert.equal(orders, 0); assert.equal(results[0].status, 'rejected'); }
        else { assert.equal(orders, 1); assert.equal(results[1].status, 'rejected'); }
      }
    });
    await t.test('audit failure rolls back deletion and archive; expired session fails after lock', async () => {
      const p = await product(); const orderProduct = await product(); const order = await makeOrder(orderProduct);
      const original = prisma.$transaction.bind(prisma);
      prisma.$transaction = (work, options) => original(tx => work(new Proxy(tx, {
        get(target, key) { if (key === 'catalogAudit' || key === 'adminAudit') return { create: async () => { throw new Error('AUDIT_UNAVAILABLE'); } }; return target[key]; },
      })), options);
      try {
        await assert.rejects(deleteCatalogProduct(p.id, session.id, p.name, p.updatedAt), /AUDIT_UNAVAILABLE/);
        await assert.rejects(setOrderArchived(order.id, session.id, true), /AUDIT_UNAVAILABLE/);
      } finally { prisma.$transaction = original; }
      assert.equal(await prisma.productVariant.count({ where: { productId: p.id } }), 1);
      assert.equal(await prisma.regionalPrice.count({ where: { variantId: p.variants[0].id } }), 2);
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).archivedAt, null);
      await prisma.adminSession.update({ where: { id: other.id }, data: { expiresAt: new Date(0) } });
      await assert.rejects(setOrderArchived(order.id, other.id, true), /UNAUTHORIZED/);
    });
    await t.test('lost response after commit recovers by reading state without duplicate audit', async () => {
      const p = await product(); const order = await makeOrder(p);
      const original = prisma.$transaction.bind(prisma);
      prisma.$transaction = async (work, options) => { await original(work, options); throw { code: 'P1017' }; };
      try { await assert.rejects(setOrderArchived(order.id, session.id, true), error => adminMutationError(error).status === 503); }
      finally { prisma.$transaction = original; }
      assert.ok((await prisma.order.findUnique({ where: { id: order.id } })).archivedAt);
      assert.equal((await setOrderArchived(order.id, session.id, true)).changed, false);
      assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id, action: 'archive' } }), 1);
    });
    await t.test('reauth is checked again after waiting on the product lock', async () => {
      const p = await product();
      const temporary = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 60000), reauthenticatedAt: new Date() } });
      let locked; let release;
      const lockReady = new Promise(resolve => { locked = resolve; });
      const releaseLock = new Promise(resolve => { release = resolve; });
      const holder = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM Product WHERE id = ${p.id} FOR UPDATE`;
        locked(); await releaseLock;
        await tx.adminSession.update({ where: { id: temporary.id }, data: { reauthenticatedAt: new Date(0) } });
      });
      await lockReady;
      const deletion = deleteCatalogProduct(p.id, temporary.id, p.name, p.updatedAt);
      release(); await holder;
      await assert.rejects(deletion, /REAUTH_REQUIRED/);
      assert.ok(await prisma.product.findUnique({ where: { id: p.id } }));
    });
    await t.test('worker and archive contend safely; archived job is never resent', async () => {
      const { runFulfillment } = await import('../src/lib/fulfillmentWorker.ts');
      const p = await product('GAME');
      const order = await makeOrder(p, { fulfillmentStatus: 'QUEUED', job: { create: {} }, gameDetail: { create: { userId: 'fixture', provider: 'simulator', providerSku: 'fixture' } } });
      await Promise.allSettled([runFulfillment(), setOrderArchived(order.id, session.id, true)]);
      const current = await prisma.order.findUnique({ where: { id: order.id }, include: { job: true } });
      assert.equal(current.fulfillmentStatus, 'COMPLETED'); assert.ok(current.job.completedAt);
      await setOrderArchived(order.id, session.id, true);
      const attempts = await prisma.providerAttempt.count({ where: { jobId: current.job.id } });
      await runFulfillment();
      assert.equal(await prisma.providerAttempt.count({ where: { jobId: current.job.id } }), attempts);
      assert.ok((await prisma.order.findUnique({ where: { id: order.id } })).archivedAt);
    });
  } finally { restoreRoblox(); await prisma.$disconnect(); }
});
