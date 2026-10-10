import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const base = process.env.TEST_BASE_URL, database = process.env.TEST_DATABASE_URL;
test('invoice removal HTTP authorization, confirmation, views and customer access', { skip: !base || !database }, async t => {
  const endpoint = new URL(base), target = new URL(database);
  assert.ok(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(target.pathname));
  process.env.DATABASE_URL = database;
  const { prisma } = await import('../src/lib/prisma.ts');
  const token = crypto.randomBytes(32).toString('base64url');
  const session = await prisma.adminSession.create({ data: { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
  const headers = { cookie: `admin_session_token=${token}`, origin: endpoint.origin, 'content-type': 'application/json' };
  const request = (path, method = 'GET', body, extra = {}) => fetch(new URL(path, endpoint), { method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const product = await prisma.product.create({ data: { name: 'HTTP removal fixture', slug: crypto.randomUUID(), type: 'ROBLOX', price: 1000 } });
  const prefix = `removed-${crypto.randomUUID()}`;
  const fixture = () => prisma.order.create({ data: { productId: product.id, productName: product.name, type: 'ROBLOX', invoice: `${prefix}-${crypto.randomUUID()}`, customerEmail: 'fixture@example.test', totalAmount: 1000,
    status: 'PAID', fulfillmentStatus: 'COMPLETED', archivedAt: new Date(), expiresAt: new Date(), paymentReference: crypto.randomUUID(), job: { create: { completedAt: new Date() } }, robloxDetail: { create: { method: 'LOGIN', username: 'fixture' } } } });
  const order = await fixture(), path = `/api/admin/fulfillment/${order.id}/remove`;
  const body = { removed: true, confirmationInvoice: order.invoice };
  const expectError = async (response, status, code) => { assert.equal(response.status, status); assert.equal((await response.json()).errorCode, code); };
  try {
    await t.test('auth, CSRF, recent reauth, input and exact invoice are enforced server-side', async () => {
      await expectError(await request(path, 'PATCH', body, { cookie: '' }), 401, 'UNAUTHORIZED');
      await expectError(await request(path, 'PATCH', body, { origin: 'https://other.invalid' }), 403, 'CSRF_REJECTED');
      await expectError(await request(path, 'PATCH', body), 403, 'REAUTH_REQUIRED');
      assert.equal((await request('/api/admin/reauth', 'POST', { password: 'isolated-http-test-password' })).status, 200);
      for (const malformed of [{ removed: true }, { removed: true, confirmationInvoice: 1 }, { ...body, sessionId: 'fake' }, { removed: 'true' }, { removed: false, confirmationInvoice: order.invoice }]) await expectError(await request(path, 'PATCH', malformed), 400, 'INVALID_INPUT');
      for (const confirmationInvoice of ['wrong', order.invoice + ' ']) await expectError(await request(path, 'PATCH', { ...body, confirmationInvoice }), 400, 'INVOICE_CONFIRMATION_MISMATCH');
      await expectError(await request('/api/admin/fulfillment/nope/remove', 'PATCH', body), 400, 'INVALID_INPUT');
      await expectError(await request('/api/admin/fulfillment/2147483647/remove', 'PATCH', body), 404, 'ORDER_NOT_FOUND');
    });
    await t.test('removal preserves invoice tokens, financial aggregates and archived timestamp; normal lists exclude it', async () => {
      const customer = token => fetch(new URL(`/api/orders/${order.invoice}`, endpoint), { headers: { 'x-order-token': token } });
      const before = await (await customer(order.accessToken)).json();
      const analytics = await (await request('/api/admin/analytics')).json();
      const response = await request(path, 'PATCH', body);
      assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private, no-store/);
      const result = (await response.json()).data; assert.equal(result.changed, true); assert.equal(result.archivedAt, order.archivedAt.toISOString());
      assert.equal((await (await request(path, 'PATCH', body)).json()).data.changed, false);
      for (const archive of ['active', 'archived', 'all']) {
        const data = await (await request(`/api/admin/fulfillment?archive=${archive}&q=${order.invoice}`)).json();
        assert.deepEqual(data.data, []);
      }
      const removed = await (await request(`/api/admin/fulfillment?archive=removed&q=${order.invoice}&method=LOGIN&type=ROBLOX&payment=PAID&status=COMPLETED`)).json();
      assert.equal(removed.data.length, 1); assert.equal(removed.data[0].canRemove, false);
      for (const field of ['sessionId', 'leaseToken', 'accessToken', 'customerEmail']) assert.equal(JSON.stringify(removed).includes(`"${field}"`), false);
      // Query every page to ensure exclusion is not merely a limit artifact.
      let cursor = null;
      do {
        const page = await (await request('/api/admin/orders?limit=100' + (cursor ? '&cursor=' + cursor : ''))).json();
        assert.ok(page.data.every(row => row.id !== order.id)); cursor = page.pagination.nextCursor;
      } while (cursor);
      assert.deepEqual(await (await customer(order.accessToken)).json(), before);
      assert.equal((await customer('invalid')).status, 404);
      assert.deepEqual(await (await request('/api/admin/analytics')).json(), analytics);
      await expectError(await request(`/api/admin/fulfillment/${order.id}/archive`, 'PATCH', { archived: false }), 409, 'ORDER_REMOVED');
    });
    await t.test('valid recent reauth is reused for more than five removals and removed pagination remains stable', async () => {
      const before = await prisma.adminSession.findUnique({ where: { id: session.id } });
      for (let i = 0; i < 6; i++) {
        const row = await fixture();
        assert.equal((await request(`/api/admin/fulfillment/${row.id}/remove`, 'PATCH', { removed: true, confirmationInvoice: row.invoice })).status, 200);
      }
      assert.deepEqual((await prisma.adminSession.findUnique({ where: { id: session.id } })).reauthenticatedAt, before.reauthenticatedAt);
      const seen = new Set(); let cursor = null;
      do {
        const page = await (await request(`/api/admin/fulfillment?archive=removed&q=${prefix}&limit=2` + (cursor ? '&cursor=' + cursor : ''))).json();
        for (const row of page.data) { assert.equal(seen.has(row.id), false); seen.add(row.id); }
        cursor = page.pagination.nextCursor;
      } while (cursor);
      assert.equal(seen.size, 7);
    });
    await t.test('restore returns to archived without reauth, redelivery or duplicate audit', async () => {
      await prisma.adminSession.update({ where: { id: session.id }, data: { reauthenticatedAt: null } });
      const restored = await request(path, 'PATCH', { removed: false }); assert.equal(restored.status, 200);
      assert.equal((await restored.json()).data.archivedAt, order.archivedAt.toISOString());
      assert.equal((await (await request(path, 'PATCH', { removed: false })).json()).data.changed, false);
      const archived = await (await request(`/api/admin/fulfillment?archive=archived&q=${order.invoice}`)).json();
      assert.equal(archived.data.length, 1);
      assert.deepEqual((await prisma.adminAudit.findMany({ where: { orderId: order.id }, orderBy: { id: 'asc' } })).map(a => a.action), ['remove', 'restore_removed']);
      assert.ok((await prisma.fulfillmentJob.findUnique({ where: { orderId: order.id } })).completedAt);
      assert.equal((await request(`/api/admin/fulfillment/${order.id}/archive`, 'PATCH', { archived: false })).status, 200);
    });
  } finally { await prisma.$disconnect(); }
});
