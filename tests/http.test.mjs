import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const base = process.env.TEST_BASE_URL; const db = process.env.TEST_DATABASE_URL;
test('HTTP authorization, CSRF, reauthentication and response redaction', { skip: !base || !db }, async () => {
  const endpoint = new URL(base); const database = new URL(db);
  assert.ok(['127.0.0.1', 'localhost'].includes(endpoint.hostname));
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(database.pathname));
  process.env.DATABASE_URL = db; process.env.ENCRYPTION_KEY = 'test-key'; process.env.ROBLOX_CHECKOUT_ENABLED = 'true';
  delete process.env.TELEGRAM_BOT_TOKEN;
  const { prisma } = await import('../src/lib/prisma.ts');
  const { createCheckout } = await import('../src/lib/checkout.ts');
  const { applyPaymentStatus } = await import('../src/lib/payments.ts');
  try {
    const p = await prisma.product.create({ data: { name: 'HTTP Roblox', slug: `http-${crypto.randomUUID()}`, price: 0, type: 'ROBLOX', variants: { create: { name: 'Login 100', price: 2000, units: 100, method: 'LOGIN', active: true } } }, include: { variants: true } });
    const secret = { password: 'HTTP-private-password', backupCodes: ['code111','code222','code333','code444','code555'] };
    const { order } = await createCheckout({ productId: p.id, variantId: p.variants[0].id, customerEmail: 'http@example.test', details: { username: 'httptest', ...secret } }, crypto.randomUUID());
    await applyPaymentStatus(order.id, { order_id: order.invoice, status_code: '200', transaction_status: 'settlement', gross_amount: String(order.totalAmount), currency: 'IDR' });
    const request = (path, init = {}) => fetch(new URL(path, base), init);
    assert.equal((await request('/api/admin/fulfillment')).status, 401);
    assert.equal((await request(`/api/orders/${order.invoice}`, { headers: { 'x-order-token': 'wrong' } })).status, 404);
    const customer = await request(`/api/orders/${order.invoice}`, { headers: { 'x-order-token': order.accessToken } });
    assert.equal(customer.status, 200); assert.ok(customer.headers.get('cache-control').includes('no-store'));
    const text = await customer.text(); assert.ok(!text.includes(secret.password)); assert.ok(!text.includes('ciphertext')); assert.ok(!text.includes(secret.backupCodes[0]));
    const login = await request('/api/admin/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: endpoint.origin }, body: JSON.stringify({ password: 'isolated-http-test-password' }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.getSetCookie().find(c => c.startsWith('admin_session_token=')).split(';')[0];
    const headers = { Cookie: cookie, Origin: endpoint.origin, 'Content-Type': 'application/json' };
    const action = body => request(`/api/admin/fulfillment/${order.id}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const csrf = await request(`/api/admin/fulfillment/${order.id}`, { method: 'POST', headers: { ...headers, Origin: 'https://evil.example' }, body: JSON.stringify({ action: 'claim' }) });
    assert.equal(csrf.status, 403);
    assert.equal((await action({ action: 'claim' })).status, 200);
    const beforeReauth = await action({ action: 'reveal' }); assert.equal(beforeReauth.status, 403); assert.equal((await beforeReauth.json()).errorCode, 'REAUTH_REQUIRED');
    const reauth = await request('/api/admin/reauth', { method: 'POST', headers, body: JSON.stringify({ password: 'isolated-http-test-password' }) }); assert.equal(reauth.status, 200);
    const reveal = await action({ action: 'reveal' }); assert.equal(reveal.status, 200); assert.ok(reveal.headers.get('cache-control').includes('no-store')); assert.deepEqual((await reveal.json()).data, secret);
    const list = await request('/api/admin/fulfillment', { headers }); const listed = await list.text(); assert.ok(!listed.includes(secret.password)); assert.ok(!listed.includes('ciphertext')); assert.ok(!listed.includes(secret.backupCodes[0]));
    assert.equal((await action({ action: 'complete', evidence: 'http-delivery-reference' })).status, 200);
    assert.equal((await action({ action: 'reveal' })).status, 403);
    assert.equal(await prisma.orderSecret.count({ where: { orderId: order.id } }), 0);
    await request('/api/admin/auth', { method: 'DELETE', headers });
  } finally { await prisma.$disconnect(); }
});
