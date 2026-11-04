import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { geoHeaders, geoSecret, geoAudience } from './geo-fixture.mjs';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/headers' || specifier === 'next/headers.js') return { url: 'data:text/javascript,export async function cookies(){return {get(){return undefined}}}', shortCircuit: true };
  return next(specifier, context);
} });
process.env.ENCRYPTION_KEY = 'isolated-access-test';
Object.assign(process.env, { GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret, GEOIP_INGRESS_AUDIENCE: geoAudience });
let session = null;
const order = { id: 1, invoice: 'INV-OWNER', accessToken: 'owner-token', type: 'APPS', status: 'PAID', refundStatus: 'NONE', productId: 1,
  appsSnapshot: { version: 1, appGroup: 'test', accountType: 'Private', durationDays: 7, devices: 'fixture', regionRules: 'ID', usageRules: 'fixture', included: 'fixture', instructions: 'fixture', warrantyDays: 7, warrantyTerms: 'fixture', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' },
  appsService: { activeFrom: new Date(), activeUntil: new Date(Date.now() + 86400000) }, product: { id: 1, active: true, price: 1000, name: 'Synthetic', appsConfig: null } };
order.product.appsConfig = order.appsSnapshot;
globalThis.prisma = { order: { findFirst: async ({ where }) => where.invoice === order.invoice && where.accessToken === order.accessToken ? order : null },
  adminSession: { findUnique: async () => session } };
const invoice = await import('../src/app/api/orders/[id]/apps/route.ts');
const reminders = await import('../src/app/api/orders/[id]/reminders/route.ts');
const renew = await import('../src/app/api/orders/[id]/renew/route.ts');
const admin = await import('../src/app/api/admin/apps/orders/route.ts');
const params = id => ({ params: Promise.resolve({ id }) });
function request(path, token) { return new Request('https://store.example.test' + path, { method: 'POST', headers: { ...(token === undefined ? {} : { 'x-order-token': token }), 'content-type': 'application/json' }, body: JSON.stringify({ action: 'acknowledge' }) }); }

test('missing, wrong and cross-invoice tokens cannot mutate Apps or view renewal data', async () => {
  for (const [id, token] of [['INV-OWNER', undefined], ['INV-OWNER', 'wrong'], ['INV-OTHER', 'owner-token']]) {
    assert.equal((await invoice.POST(request('/api/orders/' + id + '/apps', token), params(id))).status, 404);
    assert.equal((await reminders.POST(request('/api/orders/' + id + '/reminders', token), params(id))).status, 404);
    assert.equal((await renew.GET(new Request('https://store.example.test/api/orders/' + id + '/renew', { headers: token ? { 'x-order-token': token } : {} }), params(id))).status, 404);
  }
});
test('renewal quote is private and requires the source owner token', async () => {
  const url = 'https://store.example.test/api/orders/INV-OWNER/renew';
  const response = await renew.GET(new Request(url, { headers: { 'x-order-token': 'owner-token', ...geoHeaders(url) } }), params('INV-OWNER'));
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const data = await response.json(); assert.equal(data.data.price, 1000); assert.equal(data.data.customerEmail, undefined);
});
test('Apps admin rejects missing/expired session and stale recent authentication', async () => {
  const req = () => new Request('https://store.example.test/api/admin/apps/orders', { method: 'POST', headers: { authorization: 'Bearer ' + 'a'.repeat(43), 'content-type': 'application/json' }, body: JSON.stringify({ orderId: 1, action: 'claim' }) });
  assert.equal((await admin.POST(req())).status, 401);
  session = { id: 'expired', expiresAt: new Date(0), reauthenticatedAt: new Date() };
  assert.equal((await admin.POST(req())).status, 401);
  session = { id: 'stale', expiresAt: new Date(Date.now() + 60000), reauthenticatedAt: new Date(0) };
  assert.equal((await admin.POST(req())).status, 403);
});
test('refunded Apps order hides account credentials and OTP state on invoice detail', async () => {
  const { encryptData } = await import('../src/lib/crypto.ts');
  const detail = await import('../src/app/api/orders/[id]/route.ts');
  order.createdAt = new Date();
  order.audits = [];
  order.accountStock = { emailAccount: encryptData('user@example.test'), passwordAccount: encryptData('synthetic-secret'), profileName: 'Profile 1', pin: null, additionalInfo: null };
  const fetchDetail = async () => (await (await detail.GET(new Request('https://store.example.test/api/orders/INV-OWNER', { headers: { 'x-order-token': 'owner-token' } }), params('INV-OWNER'))).json()).data;
  order.refundStatus = 'NONE';
  assert.equal((await fetchDetail()).account?.emailAccount, 'user@example.test');
  for (const status of ['REQUIRED', 'COMPLETED']) {
    order.refundStatus = status;
    assert.equal((await fetchDetail()).account, null);
  }
  order.refundStatus = 'NONE';
});
test('admin product update enforces optimistic lock and records catalogAudit', async () => {
  const productRoute = await import('../src/app/api/admin/products/[id]/route.ts');
  const stockRoute = await import('../src/app/api/admin/stock/route.ts');
  const audits = [];
  const stamp = new Date('2026-11-01T10:00:00.000Z');
  let productRow = { id: 7, name: 'Old Name', type: 'APPS', price: 10000, category: 'Apps', updatedAt: stamp };
  globalThis.prisma.$transaction = async fn => fn(globalThis.prisma);
  globalThis.prisma.$queryRaw = async () => [];
  globalThis.prisma.product = {
    findUnique: async ({ where }) => where.id === productRow.id ? productRow : null,
    update: async ({ data }) => { productRow = { ...productRow, ...data, updatedAt: new Date('2026-11-01T10:05:00.000Z') }; return productRow; },
  };
  globalThis.prisma.catalogAudit = { create: async ({ data }) => { audits.push(data); } };
  session = null;
  const putReq = body => new Request('https://store.example.test/api/admin/products/7', {
    method: 'PUT',
    headers: { authorization: 'Bearer ' + 'a'.repeat(43), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  assert.equal((await productRoute.PUT(putReq({ name: 'New', price: 15000, expectedUpdatedAt: stamp.toISOString() }), params('7'))).status, 401);
  assert.equal((await stockRoute.POST(new Request('https://store.example.test/api/admin/stock', { method: 'POST', headers: { authorization: 'Bearer bad' } }))).status, 401);
  session = { id: 'admin-1', expiresAt: new Date(Date.now() + 60000), reauthenticatedAt: new Date() };
  const stale = await productRoute.PUT(putReq({ name: 'New', price: 15000, expectedUpdatedAt: '2026-10-01T00:00:00.000Z' }), params('7'));
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).errorCode, 'PRODUCT_CHANGED');
  const ok = await productRoute.PUT(putReq({ name: 'Updated Name', price: 15000, expectedUpdatedAt: stamp.toISOString() }), params('7'));
  assert.equal(ok.status, 200);
  assert.equal(productRow.name, 'Updated Name');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'product-updated');
  assert.equal(audits[0].sessionId, 'admin-1');
});
