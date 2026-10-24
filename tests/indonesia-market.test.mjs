import test from 'node:test';
import assert from 'node:assert/strict';
import { geoHeaders, geoSecret, geoAudience } from './geo-fixture.mjs';

Object.assign(process.env, { GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret,
  GEOIP_INGRESS_AUDIENCE: geoAudience, MIDTRANS_SERVER_KEY: 'isolated-market-fixture',
  CHECKOUT_HASH_KEY: 'isolated-market-hash', ROBLOX_CHECKOUT_ENABLED: 'true' });
delete process.env.DATABASE_URL;
let productType = 'APPS';
let transactions = 0;
const config = { version: 1, appGroup: 'fixture', accountType: 'Private', durationDays: 7, devices: 'one', regionRules: 'ID', usageRules: 'rules', included: 'access', instructions: 'guide', warrantyDays: 7, warrantyTerms: 'terms', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' };
const variant = { id: 2, name: 'Synthetic package', price: 7000, units: 50, method: 'GAMEPASS',
  regionalPrices: [{ region: 'MY', amount: 250, active: true }, { region: 'PH', amount: 3000, active: true }] };
globalThis.prisma = {
  product: { findMany: async () => [{ id: 1, name: 'Synthetic product', slug: 'fixture', price: 7000,
    type: productType, appsConfig: null, variants: [variant], _count: { stocks: 1 } }] },
  productVariant: { findFirst: async () => { throw new Error('UNEXPECTED_PRODUCT_QUERY'); } },
  rateLimit: { upsert: async () => ({ points: 1 }) },
  order: {
    findUnique: async () => null,
    findFirst: async ({ where }) => where.invoice === 'INV-fixture' && where.accessToken === 'synthetic-access'
      ? { id: 10, productId: 1, customerEmail: 'fixture@example.test', appsSnapshot: config, appsService: { activeFrom: new Date() },
        product: { id: 1, name: 'Synthetic renewal', active: true, price: 7000, appsConfig: config } } : null,
  },
  $transaction: async () => { transactions++; throw new CommerceError('PRODUCT_UNAVAILABLE'); },
};
const { CommerceError } = await import('../src/lib/commerce.ts');
const { GET: catalog } = await import('../src/app/api/products/route.ts');
const { POST: quote } = await import('../src/app/api/checkout/quote/route.ts');
const { GET: renewalOffer, POST: renewal } = await import('../src/app/api/orders/[id]/renew/route.ts');

test('catalog disables all new purchases outside Indonesia and hides foreign Roblox prices', async () => {
  for (productType of ['APPS', 'ROBLOX']) for (const country of ['ID', 'MY', 'PH', 'US', null]) {
    const url = `https://store.test/api/products?type=${productType}&region=ID`;
    const response = await catalog(new Request(url, { headers: { ...(country ? geoHeaders(url, country) : {}), 'accept-language': 'id-ID', cookie: 'region=ID' } }));
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
    const body = await response.json();
    assert.equal(body.data[0].checkoutEnabled, country === 'ID');
    assert.equal(body.location.region, country === 'ID' ? 'ID' : null);
    assert.equal(body.paymentMethods.length, country === 'ID' ? 1 : 0);
    if (productType === 'APPS') assert.equal(body.data[0].price, country === 'ID' ? 7000 : null);
    if (productType === 'ROBLOX') {
      assert.equal(body.data[0].variants[0].price, country === 'ID' ? 7000 : null);
      assert.equal(body.data[0].currency, country === 'ID' ? 'IDR' : null);
      assert.deepEqual(body.data[0].variants[0].regionalPrices, []);
    }
  }
});

test('renewal offers and commits require Indonesia while invoice authorization still comes first', async () => {
  const url = 'https://store.test/api/orders/INV-fixture/renew';
  const context = { params: Promise.resolve({ id: 'INV-fixture' }) };
  for (const country of ['ID', 'MY', 'PH', null]) {
    const request = method => new Request(url, { method,
      headers: { 'Content-Type': 'application/json', 'x-order-token': 'synthetic-access', 'idempotency-key': 'r'.repeat(32),
        ...(country ? geoHeaders(url, country, method) : {}) },
      ...(method === 'POST' ? { body: JSON.stringify({ appsPolicyToken: 'a'.repeat(64) }) } : {}) });
    const offer = await renewalOffer(request('GET'), context);
    assert.equal(offer.status, country === 'ID' ? 200 : 409);
    if (country !== 'ID') assert.equal((await offer.json()).errorCode, 'REGION_UNVERIFIED');
    transactions = 0;
    const submitted = await renewal(request('POST'), context);
    assert.equal((await submitted.json()).errorCode, country === 'ID' ? 'PRODUCT_UNAVAILABLE' : 'REGION_UNVERIFIED');
    assert.equal(transactions, country === 'ID' ? 1 : 0);
  }
  const denied = await renewalOffer(new Request(url), context);
  assert.equal(denied.status, 404);
});

test('foreign and unverified quote requests stop before product lookup or any provider call', async () => {
  const url = 'https://store.test/api/checkout/quote';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('UNEXPECTED_PROVIDER_CALL'); };
  try {
    for (const country of ['MY', 'PH', 'US', null]) {
      const response = await quote(new Request(url, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(country ? geoHeaders(url, country, 'POST') : {}) },
        body: JSON.stringify({ productId: 1, variantId: 2, paymentMethod: 'QRIS' }) }));
      assert.equal(response.status, 409);
      assert.equal((await response.json()).errorCode, 'REGION_UNVERIFIED');
    }
  } finally { globalThis.fetch = previousFetch; }
});
