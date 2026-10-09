import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const base = process.env.TEST_BASE_URL; const database = process.env.TEST_DATABASE_URL;
test('catalog lifecycle and order archive HTTP authorization, filters and invoice preservation', { skip: !base || !database }, async t => {
  const endpoint = new URL(base); const db = new URL(database);
  assert.ok(['localhost','127.0.0.1'].includes(endpoint.hostname));
  assert.ok(['localhost','127.0.0.1'].includes(db.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(db.pathname));
  process.env.DATABASE_URL = database;
  const { prisma } = await import('../src/lib/prisma.ts');
  const token = crypto.randomBytes(32).toString('base64url');
  const session = await prisma.adminSession.create({ data: { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000) } });
  const headers = { cookie: `admin_session_token=${token}`, origin: endpoint.origin, 'content-type': 'application/json' };
  const request = (path, method = 'GET', body, extra = {}) => fetch(new URL(path, endpoint), { method, headers: { ...headers, ...extra }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const createProduct = async () => {
    const response = await request('/api/admin/catalog', 'POST', { kind: 'product', name: 'HTTP archive fixture', slug: crypto.randomUUID(), type: 'ROBLOX', active: true });
    assert.equal(response.status, 200); return (await response.json()).data;
  };
  const orderFixture = async (p, patch = {}) => prisma.order.create({ data: { productId: p.id, type: 'ROBLOX', productName: p.name, variantName: 'Username', invoice: `archive-${crypto.randomUUID()}`, customerEmail: 'private@example.test', totalAmount: 3000,
    status: 'PAID', fulfillmentStatus: 'COMPLETED', expiresAt: new Date(), job: { create: { completedAt: new Date(), ownerSessionId: 'another-session' } },
    robloxDetail: { create: { method: 'GIFT_USERNAME', username: 'archivecustomer' } }, ...patch } });
  try {
    await t.test('delete authenticates, requires exact origin and recent reauth, and validates payload', async () => {
      const p = await createProduct(); const path = `/api/admin/catalog/${p.id}`;
      const body = { confirmationName: p.name, expectedUpdatedAt: p.updatedAt };
      assert.equal((await fetch(new URL(path, endpoint), { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, 401);
      assert.equal((await request(path, 'DELETE', body, { origin: 'https://other.invalid' })).status, 403);
      let response = await request(path, 'DELETE', body); assert.equal(response.status, 403); assert.equal((await response.json()).errorCode, 'REAUTH_REQUIRED');
      assert.equal((await request('/api/admin/reauth', 'POST', { password: 'isolated-http-test-password' })).status, 200);
      assert.equal((await request(path, 'DELETE', { ...body, confirmationName: 'incorrect' })).status, 400);
      assert.equal((await request(path, 'DELETE', { ...body, sessionId: 'fake' })).status, 400);
      assert.equal((await request(path, 'DELETE', { ...body, expectedUpdatedAt: new Date(0).toISOString() })).status, 409);
      response = await request(path, 'DELETE', body); assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /no-store/);
      assert.equal(await prisma.catalogAudit.count({ where: { productId: p.id, sessionId: session.id, action: 'product-deleted' } }), 1);
      assert.equal((await request(path, 'DELETE', body)).status, 404);
    });
    await t.test('legacy editor and PATCH audit activation, and catalog exposes safe deletion hints', async () => {
      const p = await createProduct(); await orderFixture(p);
      let response = await request('/api/admin/catalog', 'POST', { kind: 'product', id: p.id, name: p.name, slug: p.slug, type: p.type, active: false });
      assert.equal(response.status, 200); const off = (await response.json()).data;
      response = await request(`/api/admin/catalog/${p.id}`, 'PATCH', { active: true, expectedUpdatedAt: off.updatedAt });
      assert.equal(response.status, 200);
      assert.equal(await prisma.catalogAudit.count({ where: { productId: p.id } }), 2);
      const data = await (await request('/api/admin/catalog')).json(); const current = data.data.find(row => row.id === p.id);
      assert.deepEqual(current.deletion, { allowed: false, reasonCodes: ['PRODUCT_HAS_ORDERS'] });
      assert.equal('orders' in current, false); assert.equal('stocks' in current, false);
      response = await request(`/api/admin/catalog/${p.id}`, 'DELETE', { confirmationName: p.name, expectedUpdatedAt: current.updatedAt });
      assert.equal(response.status, 409);
    });
    await t.test('editor state regression: editing a deactivated product maintains its active state', async () => {
      const p = await createProduct();
      
      // Admin clicks Deactivate in the UI list
      let res = await request(`/api/admin/catalog/${p.id}`, 'PATCH', { active: false, expectedUpdatedAt: p.updatedAt });
      assert.equal(res.status, 200);
      let updatedP = (await res.json()).data;
      assert.equal(updatedP.active, false);

      // The UI form remounts with the new 'active: false' status.
      // Admin changes the name and clicks save. The UI correctly sends active: false.
      res = await request('/api/admin/catalog', 'POST', { kind: 'product', id: p.id, type: p.type, name: 'Renamed Product', slug: p.slug, active: false });
      assert.equal(res.status, 200);
      updatedP = (await res.json()).data;
      
      // Verify product remains inactive
      assert.equal(updatedP.active, false);
      assert.equal(updatedP.name, 'Renamed Product');
      
      // Edit -> Reactivate -> Save
      res = await request(`/api/admin/catalog/${p.id}`, 'PATCH', { active: true, expectedUpdatedAt: updatedP.updatedAt });
      updatedP = (await res.json()).data;
      assert.equal(updatedP.active, true);
      
      res = await request('/api/admin/catalog', 'POST', { kind: 'product', id: p.id, type: p.type, name: 'Renamed Again', slug: p.slug, active: true });
      updatedP = (await res.json()).data;
      assert.equal(updatedP.active, true);
      assert.equal(updatedP.name, 'Renamed Again');
    });
    await t.test('archive authorization, idempotency, views, redaction, pagination and customer invoice', async () => {
      const p = await createProduct(); const order = await orderFixture(p); const second = await orderFixture(p);
      const queued = await orderFixture(p, { fulfillmentStatus: 'QUEUED', job: { create: {} } });
      const path = `/api/admin/fulfillment/${order.id}/archive`;
      assert.equal((await request(path, 'PATCH', { archived: true }, { cookie: '' })).status, 401);
      assert.equal((await request(path, 'PATCH', { archived: true }, { origin: 'https://other.invalid' })).status, 403);
      assert.equal((await request(path, 'PATCH', { archived: true, status: 'PAID' })).status, 400);
      assert.equal((await request(`/api/admin/fulfillment/${queued.id}/archive`, 'PATCH', { archived: true })).status, 409);
      // Archiving does not require ownership or recent reauthentication.
      await prisma.adminSession.update({ where: { id: session.id }, data: { reauthenticatedAt: null } });
      const before = await (await fetch(new URL(`/api/orders/${order.invoice}`, endpoint), { headers: { 'x-order-token': order.accessToken } })).json();
      const results = await Promise.all([request(path, 'PATCH', { archived: true }), request(path, 'PATCH', { archived: true })]);
      for (const r of results) assert.equal(r.status, 200);
      const parsed = await Promise.all(results.map(r => r.json())); assert.equal(parsed.filter(r => r.data.changed).length, 1);
      await request(`/api/admin/fulfillment/${second.id}/archive`, 'PATCH', { archived: true });
      const query = `type=ROBLOX&method=GIFT_USERNAME&q=${encodeURIComponent(order.invoice)}`;
      const active = await (await request('/api/admin/fulfillment?' + query)).json(); assert.equal(active.data.length, 0);
      const archived = await (await request('/api/admin/fulfillment?' + query + '&archive=archived')).json();
      assert.equal(archived.data.length, 1); assert.equal(archived.data[0].contactEmail, null); assert.equal(archived.data[0].owned, false);
      for (const field of ['ownerSessionId','leaseToken','sessionId','secret','accountStock','customerEmail','accessToken']) assert.equal(JSON.stringify(archived).includes(`"${field}"`), false, field);
      assert.equal(archived.data[0].currency, 'IDR'); assert.equal(archived.data[0].pricingRegion, 'ID');
      const pending = await (await request('/api/admin/fulfillment?type=ROBLOX&archive=archived')).json(); assert.ok(pending.monitoring.pendingCount > 0);
      const page = await (await request('/api/admin/fulfillment?archive=archived&limit=1')).json(); assert.equal(page.data.length, 1); assert.ok(page.pagination.nextCursor);
      const next = await (await request('/api/admin/fulfillment?archive=archived&limit=1&cursor=' + page.pagination.nextCursor)).json(); assert.ok(next.data[0].id < page.data[0].id);
      assert.equal((await request('/api/admin/fulfillment?archive=invalid')).status, 400);
      const after = await (await fetch(new URL(`/api/orders/${order.invoice}`, endpoint), { headers: { 'x-order-token': order.accessToken } })).json();
      assert.deepEqual(after, before);
      assert.equal((await fetch(new URL(`/api/orders/${order.invoice}`, endpoint), { headers: { 'x-order-token': 'wrong-token' } })).status, 404);
      const reports = await (await request('/api/admin/orders')).json(); assert.ok(reports.data.some(row => row.id === order.id));
      assert.equal((await request(path, 'PATCH', { archived: false })).status, 200);
      assert.equal((await (await request(path, 'PATCH', { archived: false })).json()).data.changed, false);
      const audits = await prisma.adminAudit.findMany({ where: { orderId: order.id } }); assert.deepEqual(audits.map(a => a.action), ['archive','restore']); assert.ok(audits.every(a => a.sessionId === session.id));
      assert.equal((await (await request('/api/admin/fulfillment?' + query)).json()).data.length, 1);
    });
    await t.test('variant edits and deletion serialize without orphan configurations', async () => {
      assert.equal((await request('/api/admin/reauth', 'POST', { password: 'isolated-http-test-password' })).status, 200);
      for (let i = 0; i < 4; i++) {
        const p = await createProduct();
        const [edit, deletion] = await Promise.all([
          request('/api/admin/catalog', 'POST', { kind: 'variant', productId: p.id, name: 'Concurrent package', price: 1000, units: 100, method: 'LOGIN', active: false }),
          request(`/api/admin/catalog/${p.id}`, 'DELETE', { confirmationName: p.name, expectedUpdatedAt: p.updatedAt }),
        ]);
        assert.ok([200,400,409].includes(edit.status), `Unexpected edit status: ${edit.status}`); assert.ok([200,409].includes(deletion.status));
        const current = await prisma.product.findUnique({ where: { id: p.id }, include: { variants: true } });
        if (deletion.status === 200) { assert.equal(current, null); assert.equal(await prisma.productVariant.count({ where: { productId: p.id } }), 0); }
        else { assert.ok(current); assert.equal(edit.status, 200); assert.equal(current.variants.length, 1); }
      }
    });
  } finally { await prisma.$disconnect(); }
});
