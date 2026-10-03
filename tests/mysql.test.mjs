import { mockRoblox } from './roblox-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const url = process.env.TEST_DATABASE_URL;
test('commerce integration against isolated MySQL', { skip: !url }, async t => {
  const parsed = new URL(url);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(parsed.pathname), 'Only an explicitly named isolated localhost test database is allowed');
  process.env.DATABASE_URL = url;
  process.env.ENCRYPTION_KEY = 'test-key'; process.env.ROBLOX_CHECKOUT_ENABLED = 'true'; process.env.GAME_PROVIDER = 'simulator';
  delete process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_CHAT_ID;
  const restoreRoblox = mockRoblox();
  const { prisma } = await import('../src/lib/prisma.ts');
  const { createCheckout } = await import('../src/lib/checkout.ts');
  const { applyPaymentStatus } = await import('../src/lib/payments.ts');
  const { manualAction, revealSecret } = await import('../src/lib/manualFulfillment.ts');
  const { runFulfillment, purgeExpiredSecrets } = await import('../src/lib/fulfillmentWorker.ts');
  const { encryptData } = await import('../src/lib/crypto.ts');
  const suffix = crypto.randomUUID();
  const paid = order => ({ order_id: order.invoice, status_code: '200', transaction_status: 'settlement', gross_amount: String(order.totalAmount), currency: 'IDR' });
  const key = () => crypto.randomUUID();
  const loginDetails = { username: 'customer', password: 'private-password', backupCodes: ['1111','2222','3333','4444','5555'], note: 'Private account note' };
  try {
    const apps = await prisma.product.create({ data: { name: 'Apps', slug: `apps-${suffix}`, price: 1000 } });
    await prisma.accountStock.create({ data: { productId: apps.id, emailAccount: encryptData('account@example.test'), passwordAccount: encryptData('stock-password') } });
    const roblox = await prisma.product.create({ data: { name: 'Roblox', slug: `roblox-${suffix}`, price: 0, type: 'ROBLOX', variants: { create: { name: 'Login 100', price: 2000, units: 100, method: 'LOGIN', active: true } } }, include: { variants: true } });
    const game = await prisma.product.create({ data: { name: 'Game', slug: `game-${suffix}`, price: 0, type: 'GAME', variants: { create: { name: 'Game 100', price: 3000, units: 100, providerSku: 'game-100', active: true } } }, include: { variants: true } });
    const rb = () => ({ productId: roblox.id, variantId: roblox.variants[0].id, customerEmail: 'buyer@example.test', details: loginDetails });
    await t.test('last stock can be reserved by only one checkout', async () => {
      const results = await Promise.allSettled([1,2].map(() => createCheckout({ productId: apps.id, customerEmail: 'buyer@example.test' }, key())));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      const order = results.find(r => r.status === 'fulfilled').value.order;
      await applyPaymentStatus(order.id, paid(order));
      await applyPaymentStatus(order.id, paid(order));
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'COMPLETED');
      assert.equal(await prisma.accountStock.count({ where: { productId: apps.id, status: 'SOLD' } }), 1);
    });
    await t.test('same Apps checkout key survives concurrent stock reservation', async () => {
      await prisma.accountStock.create({ data: { productId: apps.id, emailAccount: encryptData('second@example.test'), passwordAccount: encryptData('second-password') } });
      const idempotencyKey = key(); const body = { productId: apps.id, customerEmail: 'buyer@example.test' };
      const results = await Promise.all([createCheckout(body, idempotencyKey), createCheckout(body, idempotencyKey)]);
      assert.equal(results[0].order.id, results[1].order.id);
      assert.equal(results.filter(r => r.created).length, 1);
      const order = results[0].order;
      await prisma.$transaction(tx => tx.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now()-1000) } }));
      await Promise.allSettled([applyPaymentStatus(order.id, null, new Date()), applyPaymentStatus(order.id, paid(order))]);
      const current = await prisma.order.findUnique({ where: { id: order.id } });
      const stock = await prisma.accountStock.findUnique({ where: { id: order.accountStockId } });
      assert.ok((current.accountStockId === null && stock.status === 'READY') || (current.status === 'PAID' && stock.status === 'SOLD'));
    });
    await t.test('Gamepass and Username preserve snapshots without storing a secret', async () => {
      const pass = await prisma.productVariant.create({ data: { productId: roblox.id, name: 'Pass', price: 2000, units: 100, gamepassPrice: 143, method: 'GAMEPASS', active: true } });
      const gift = await prisma.productVariant.create({ data: { productId: roblox.id, name: 'Gift', price: 2000, units: 100, method: 'GIFT_USERNAME', active: true } });
      const body = { productId: roblox.id, variantId: gift.id, customerEmail: 'buyer@example.test', details: { username: 'customer' } };
      await assert.rejects(createCheckout(body, key()), /CAPACITY_REVIEW_REQUIRED/);
      await prisma.productVariant.update({ where: { id: gift.id }, data: { capacityCheckedAt: new Date() } });
      const { order } = await createCheckout(body, key());
      const result = await createCheckout({ ...body, variantId: pass.id, details: { username: 'customer', gamepassUrl: 'https://www.roblox.com/game-pass/123/example' } }, key());
      const passDetail = await prisma.robloxOrderDetail.findUnique({ where: { orderId: result.order.id } });
      assert.equal(passDetail.gamepassPrice, 143); assert.equal(passDetail.robloxUserId, '42');
      assert.equal(passDetail.gamepassId, '123'); assert.ok(passDetail.gamepassVerifiedAt);
      await prisma.productVariant.update({ where: { id: pass.id }, data: { price: 4000, units: 200 } });
      assert.equal(result.order.totalAmount, 2000); assert.equal(result.order.units, 100);
      assert.equal(await prisma.orderSecret.count({ where: { orderId: { in: [order.id, result.order.id] } } }), 0);
      await applyPaymentStatus(order.id, paid(order));
      await manualAction(order.id, 'gift-admin', 'claim'); await manualAction(order.id, 'gift-admin', 'waiting');
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'WAITING_CUSTOMER');
      await manualAction(order.id, 'gift-admin', 'review'); await manualAction(order.id, 'gift-admin', 'refund-required');
      await manualAction(order.id, 'gift-admin', 'refund-completed', 'rejected-transfer-refund');
      await assert.rejects(manualAction(order.id, 'gift-admin', 'refund-required'), /INVALID_TRANSITION/);
    });
    await t.test('concurrent replay returns one invoice; changed payload conflicts', async () => {
      const idempotencyKey = key(); const results = await Promise.all([createCheckout(rb(), idempotencyKey), createCheckout(rb(), idempotencyKey)]);
      assert.equal(results[0].order.id, results[1].order.id);
      await assert.rejects(createCheckout({ ...rb(), customerEmail: 'other@example.test' }, idempotencyKey), /IDEMPOTENCY_CONFLICT/);
      const secret = await prisma.orderSecret.findUnique({ where: { orderId: results[0].order.id } });
      assert.ok(secret.ciphertext && !secret.ciphertext.includes(loginDetails.password) && !secret.ciphertext.includes(loginDetails.note));
      // Existing orders must remain accessible when new sales or upstream lookups are unavailable.
      process.env.ROBLOX_CHECKOUT_ENABLED = 'false';
      try { assert.equal((await createCheckout(rb(), idempotencyKey)).order.id, results[0].order.id); }
      finally { process.env.ROBLOX_CHECKOUT_ENABLED = 'true'; }
    });
    await t.test('repeated payment creates one job, competing admins have one winner', async () => {
      const { order } = await createCheckout(rb(), key());
      const results = await Promise.allSettled([applyPaymentStatus(order.id, paid(order)), applyPaymentStatus(order.id, paid(order))]);
      assert.ok(results.some(r => r.status === 'fulfilled'));
      assert.equal(await prisma.fulfillmentJob.count({ where: { orderId: order.id } }), 1);
      const sessions = await Promise.all([1,2].map(() => prisma.adminSession.create({ data: { tokenHash: key(), expiresAt: new Date(Date.now() + 60000) } })));
      const claims = await Promise.allSettled(sessions.map(s => manualAction(order.id, s.id, 'claim')));
      assert.equal(claims.filter(r => r.status === 'fulfilled').length, 1);
      const owner = sessions[claims.findIndex(r => r.status === 'fulfilled')];
      assert.deepEqual(await revealSecret(order.id, owner.id), { password: loginDetails.password, backupCodes: loginDetails.backupCodes, note: loginDetails.note });
      await assert.rejects(manualAction(order.id, owner.id, 'complete'), /INVALID_TRANSITION/);
      await manualAction(order.id, owner.id, 'waiting');
      await assert.rejects(revealSecret(order.id, owner.id), /SECRET_UNAVAILABLE/);
      await manualAction(order.id, owner.id, 'complete', 'delivery-test-reference');
      assert.equal(await prisma.orderSecret.count({ where: { orderId: order.id } }), 0);
      await assert.rejects(revealSecret(order.id, owner.id), /SECRET_UNAVAILABLE/);
    });
    await t.test('only expired reservations are released; late settlement goes to review', async () => {
      const { order } = await createCheckout(rb(), key());
      await applyPaymentStatus(order.id, null, new Date());
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).status, 'PENDING');
      await prisma.$transaction(tx => tx.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now()-1000) } }));
      await applyPaymentStatus(order.id, null, new Date());
      assert.equal(await prisma.orderSecret.count({ where: { orderId: order.id } }), 0);
      await applyPaymentStatus(order.id, paid(order));
      const current = await prisma.order.findUnique({ where: { id: order.id } });
      assert.equal(current.fulfillmentStatus, 'REQUIRES_REVIEW'); assert.equal(current.status, 'PAID');
      assert.equal(await prisma.fulfillmentJob.count({ where: { orderId: order.id } }), 0);
    });
    await t.test('retention removes secrets and refund completion cannot be reopened by payment replay', async () => {
      const { order } = await createCheckout(rb(), key()); await applyPaymentStatus(order.id, paid(order));
      await prisma.orderSecret.update({ where: { orderId: order.id }, data: { expiresAt: new Date(Date.now()-1000) } });
      await purgeExpiredSecrets(); assert.equal(await prisma.orderSecret.count({ where: { orderId: order.id } }), 0);
      await manualAction(order.id, 'test-admin', 'refund-required'); await manualAction(order.id, 'test-admin', 'refund-completed', 'refund-reference');
      await applyPaymentStatus(order.id, paid(order));
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).refundStatus, 'COMPLETED');
    });
    await t.test('worker resumes with status after a crash and ambiguous delivery requires review', async () => {
      for (const prefix of ['pending-', 'unknown-']) {
        const { order } = await createCheckout({ productId: game.id, variantId: game.variants[0].id, customerEmail: 'buyer@example.test', details: { userId: '123' } }, key());
        await applyPaymentStatus(order.id, paid(order));
        await prisma.fulfillmentJob.update({ where: { orderId: order.id }, data: { reference: prefix + key(), attemptedAt: new Date(Date.now()-120000), leaseUntil: new Date(Date.now()-60000), leaseToken: 'abandoned' } });
        await runFulfillment();
        const job = await prisma.fulfillmentJob.findUnique({ where: { orderId: order.id }, include: { attempts: true } });
        assert.equal(job.attempts[0].operation, 'status');
        const current = await prisma.order.findUnique({ where: { id: order.id } });
        assert.equal(current.fulfillmentStatus, prefix === 'pending-' ? 'PROCESSING' : 'REQUIRES_REVIEW');
        if (prefix === 'unknown-') {
          await manualAction(order.id, 'review-admin', 'resolve-game', 'provider-confirmed-reference');
          assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'COMPLETED');
        }
      }
    });
    await t.test('worker timeout is reconciled and concurrent workers do not send twice', async () => {
      const { order } = await createCheckout({ productId: game.id, variantId: game.variants[0].id, customerEmail: 'buyer@example.test', details: { userId: '123' } }, key());
      await applyPaymentStatus(order.id, paid(order));
      await prisma.fulfillmentJob.update({ where: { orderId: order.id }, data: { reference: `timeout-${key()}` } });
      await Promise.all([runFulfillment(), runFulfillment()]);
      assert.equal((await prisma.order.findUnique({ where: { id: order.id } })).fulfillmentStatus, 'COMPLETED');
      const job = await prisma.fulfillmentJob.findUnique({ where: { orderId: order.id }, include: { attempts: true } });
      assert.equal(job.attempts.length, 1);
      await runFulfillment(); assert.equal(await prisma.providerAttempt.count({ where: { jobId: job.id } }), 1);
    });
  } finally { restoreRoblox(); await prisma.$disconnect(); }
});
