import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { removeEligibility } from '../src/lib/orderArchive.ts';
import { commerceTranslations } from '../src/lib/commerceTranslations.ts';

const complete = { type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'COMPLETED', refundStatus: 'NONE', archivedAt: new Date(), removedFromAdminAt: null,
  job: { completedAt: new Date(), leaseToken: null, leaseUntil: null }, secret: null, accountStock: null };
const invalid = [
  [{ archivedAt: null }, 'ORDER_NOT_ARCHIVED'], [{ type: 'APPS' }, 'ORDER_TYPE_UNSUPPORTED'],
  ...['PENDING', 'EXPIRED', 'CANCELLED'].map(status => [{ status }, 'ORDER_NOT_FINAL']),
  ...['NOT_READY', 'QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'REQUIRES_REVIEW'].map(fulfillmentStatus => [{ fulfillmentStatus }, 'ORDER_NOT_FINAL']),
  ...['REQUIRED', 'COMPLETED'].map(refundStatus => [{ refundStatus }, 'ORDER_HAS_REFUND']),
  [{ job: null }, 'JOB_NOT_COMPLETE'], [{ job: { ...complete.job, completedAt: null } }, 'JOB_NOT_COMPLETE'],
  [{ job: { ...complete.job, leaseToken: 'reserved', leaseUntil: new Date(0) } }, 'JOB_BUSY'],
  [{ job: { ...complete.job, leaseUntil: new Date(Date.now() + 3600000) } }, 'JOB_BUSY'],
  [{ secret: { orderId: 1 } }, 'ORDER_HAS_OBLIGATIONS'], [{ accountStock: { status: 'LOCKED' } }, 'ORDER_HAS_OBLIGATIONS'],
];
test('removal policy rejects each unfinished obligation and supports only completed top-ups', () => {
  for (const type of ['ROBLOX', 'GAME']) assert.equal(removeEligibility({ ...complete, type }).canRemove, true);
  for (const [patch, reason] of invalid) {
    const result = removeEligibility({ ...complete, ...patch });
    assert.equal(result.canRemove, false); assert.ok(result.removeReasonCodes.includes(reason));
  }
  assert.equal(removeEligibility({ ...complete, removedFromAdminAt: new Date() }).canRemove, false);
  for (const dict of Object.values(commerceTranslations)) for (const key of ['confirmInvoice', 'INVOICE_CONFIRMATION_MISMATCH', 'ORDER_NOT_ARCHIVED', 'ORDER_REMOVED', 'remove', 'restore_removed', 'removedView', 'confirmRemoveDesc']) assert.ok(dict[key]);
});

const database = process.env.TEST_DATABASE_URL;
test('invoice removal MySQL security, preservation, rollback and serialization', { skip: !database }, async t => {
  const target = new URL(database);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(target.pathname));
  process.env.DATABASE_URL = database;
  const { prisma } = await import('../src/lib/prisma.ts');
  const { setOrderRemovedFromAdmin: remove, setOrderArchived: archive } = await import('../src/lib/orderArchive.ts');
  const session = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date() } });
  const product = await prisma.product.create({ data: { name: 'Removal fixture', slug: crypto.randomUUID(), type: 'ROBLOX', price: 1000 } });
  const fixture = (patch = {}) => prisma.order.create({ data: { productId: product.id, type: 'ROBLOX', invoice: `remove-${crypto.randomUUID()}`, customerEmail: 'fixture@example.test', totalAmount: 1000,
    status: 'PAID', fulfillmentStatus: 'COMPLETED', archivedAt: new Date(), expiresAt: new Date(), paymentReference: crypto.randomUUID(),
    job: { create: { completedAt: new Date(), attempts: { create: { operation: 'send', outcome: 'succeeded' } } } }, ...patch } });
  const snapshot = id => prisma.order.findUnique({ where: { id }, include: { job: { include: { attempts: true } }, robloxDetail: true, gameDetail: true, accountStock: true, secret: true } });
  const preserved = order => Object.fromEntries(Object.entries(order).filter(([key]) => !['removedFromAdminAt', 'updatedAt'].includes(key)));
  try {
    await t.test('all Roblox methods and Game preserve financial snapshots and children; repeated calls write one audit', async () => {
      for (const method of ['GAMEPASS', 'LOGIN', 'GIFT_USERNAME', 'GAME']) {
        const order = await fixture(method === 'GAME' ? { type: 'GAME', gameDetail: { create: { userId: 'fixture', provider: 'simulator', providerSku: 'fixture' } } } : { robloxDetail: { create: { method, username: 'fixture' } } });
        const before = await snapshot(order.id);
        const results = await Promise.all([remove(order.id, session.id, true, order.invoice), remove(order.id, session.id, true, order.invoice)]);
        assert.equal(results.filter(r => r.changed).length, 1);
        assert.deepEqual(preserved(await snapshot(order.id)), preserved(before));
        assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id, action: 'remove' } }), 1);
        await assert.rejects(archive(order.id, session.id, false), /ORDER_REMOVED/);
        const restored = await remove(order.id, session.id, false);
        assert.deepEqual(restored.archivedAt, order.archivedAt); assert.equal(restored.removedFromAdminAt, null);
        assert.equal((await remove(order.id, session.id, false)).changed, false);
        assert.deepEqual(preserved(await snapshot(order.id)), preserved(before));
        assert.deepEqual((await prisma.adminAudit.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } })).map(a => a.action), ['remove', 'restore_removed']);
      }
    });
    await t.test('database eligibility is checked independently for every disqualifier', async () => {
      for (const [patch, reason] of invalid) {
        const input = { ...patch };
        if ('job' in input) input.job = input.job ? { create: input.job } : undefined;
        if (input.secret) input.secret = { create: { ciphertext: 'encrypted-fixture', expiresAt: new Date() } };
        if (input.accountStock) {
          const stock = await prisma.accountStock.create({ data: { productId: product.id, status: 'LOCKED', emailAccount: 'encrypted-fixture', passwordAccount: 'encrypted-fixture' } });
          delete input.accountStock; input.accountStockId = stock.id;
        }
        const order = await fixture(input);
        await assert.rejects(remove(order.id, session.id, true, order.invoice), new RegExp(reason));
        assert.equal((await snapshot(order.id)).removedFromAdminAt, null);
        assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id } }), 0);
      }
    });
    await t.test('service enforces exact confirmation and recent session even without HTTP', async () => {
      const order = await fixture();
      for (const confirmation of [undefined, '', order.invoice + ' ', 'wrong']) await assert.rejects(remove(order.id, session.id, true, confirmation), /INVOICE_CONFIRMATION_MISMATCH/);
      const stale = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date(Date.now() - 300001) } });
      await assert.rejects(remove(order.id, stale.id, true, order.invoice), /REAUTH_REQUIRED/);
      await assert.rejects(remove(order.id, 'missing', true, order.invoice), /UNAUTHORIZED/);
    });
    await t.test('session is revalidated after waiting for the order lock', async () => {
      const order = await fixture();
      const actor = await prisma.adminSession.create({ data: { tokenHash: crypto.randomUUID(), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date() } });
      let release, acquired;
      const ready = new Promise(resolve => { acquired = resolve; });
      const gate = new Promise(resolve => { release = resolve; });
      const blocker = prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`;
        acquired(); await gate;
      });
      await ready;
      const pending = remove(order.id, actor.id, true, order.invoice);
      const rejection = assert.rejects(pending, /REAUTH_REQUIRED/);
      await prisma.adminSession.update({ where: { id: actor.id }, data: { reauthenticatedAt: null } });
      release(); await blocker; await rejection;
      assert.equal((await snapshot(order.id)).removedFromAdminAt, null);
    });
    await t.test('audit failure rolls the visibility update back', async () => {
      const order = await fixture(); const original = prisma.$transaction.bind(prisma);
      prisma.$transaction = (work, options) => original(tx => work(new Proxy(tx, { get: (target, key) => key === 'adminAudit' ? { create: async () => { throw new Error('audit-fixture-failure'); } } : Reflect.get(target, key) })), options);
      try { await assert.rejects(remove(order.id, session.id, true, order.invoice), /audit-fixture-failure/); }
      finally { prisma.$transaction = original; }
      assert.equal((await snapshot(order.id)).removedFromAdminAt, null);
      assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id } }), 0);
    });
    await t.test('concurrent archive/remove/restore maintain removed implies archived and one audit per change', async () => {
      for (let i = 0; i < 5; i++) {
        const order = await fixture();
        const results = await Promise.allSettled([remove(order.id, session.id, true, order.invoice), archive(order.id, session.id, false), remove(order.id, session.id, false)]);
        for (const result of results) if (result.status === 'rejected') assert.match(result.reason.message, /ORDER_REMOVED|ORDER_NOT_ARCHIVED/);
        const current = await snapshot(order.id);
        assert.ok(!current.removedFromAdminAt || current.archivedAt);
        const changes = results.filter(r => r.status === 'fulfilled' && r.value.changed).length;
        assert.equal(await prisma.adminAudit.count({ where: { orderId: order.id } }), changes);
      }
    });
  } finally { await prisma.$disconnect(); }
});
