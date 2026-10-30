import test from 'node:test';
import assert from 'node:assert/strict';
import { geoHeaders, geoSecret, geoAudience } from './geo-fixture.mjs';

delete process.env.DATABASE_URL;
Object.assign(process.env, {
  CHECKOUT_HASH_KEY: 'isolated-game-pause-hash', ROBLOX_CHECKOUT_ENABLED: 'true',
  GAME_PROVIDER: 'simulator', MIDTRANS_SERVER_KEY: 'isolated-game-pause-provider',
  GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret, GEOIP_INGRESS_AUDIENCE: geoAudience,
});
const product = { id: 1, type: 'GAME', name: 'Synthetic game', slug: 'fixture-game', active: true,
  price: 0, variants: [{ id: 2, name: 'Synthetic package', price: 1000, units: 100, active: true,
    method: null, providerSku: 'synthetic-game', requiresZone: false }], _count: { stocks: 0 } };
let writes = 0;
let historicalOrder = null;
globalThis.prisma = {
  product: { findMany: async () => [product], findUnique: async () => product },
  productVariant: { findFirst: async () => null },
  order: { findUnique: async () => historicalOrder, create: async () => { writes++; throw new Error('UNEXPECTED_ORDER_WRITE'); } },
  rateLimit: { upsert: async () => ({ points: 1 }) },
  $queryRaw: async () => [],
  $transaction: async callback => callback(globalThis.prisma),
};
const { checkoutEnabled, requestDigest } = await import('../src/lib/commerce.ts');
const { createCheckout } = await import('../src/lib/checkout.ts');
const { GET: catalog } = await import('../src/app/api/products/route.ts');
const { POST: checkout } = await import('../src/app/api/checkout/route.ts');
const body = { productId: 1, variantId: 2, customerEmail: 'fixture@example.test', details: { userId: '123' } };
const key = 'isolated-game-pause-checkout-key-12345';

test('Game purchases stay paused in every environment, including the simulator', () => {
  const previous = process.env.NODE_ENV;
  try {
    for (const mode of ['development', 'test', 'production']) {
      process.env.NODE_ENV = mode;
      assert.equal(checkoutEnabled('GAME'), false, mode);
      assert.equal(checkoutEnabled('APPS'), true);
      assert.equal(checkoutEnabled('ROBLOX'), true);
    }
    process.env.ROBLOX_CHECKOUT_ENABLED = 'false';
    assert.equal(checkoutEnabled('ROBLOX'), false);
  } finally {
    process.env.ROBLOX_CHECKOUT_ENABLED = 'true';
    if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous;
  }
});

test('catalog marks Game purchases unavailable even with a valid Indonesian location and payment method', async () => {
  const url = 'https://store.test/api/products?type=GAME';
  const response = await catalog(new Request(url, { headers: geoHeaders(url) }));
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.location.region, 'ID');
  assert.ok(json.paymentMethods.length > 0);
  assert.equal(json.data[0].checkoutEnabled, false);
});

test('direct Game checkout is rejected without creating an order or starting payment', async () => {
  const url = 'https://store.test/api/checkout';
  const response = await checkout(new Request(url, { method: 'POST',
    headers: { ...geoHeaders(url, 'ID', 'POST'), 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body) }));
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { success: false, errorCode: 'PRODUCT_UNAVAILABLE' });
  assert.equal(writes, 0);
});

test('pausing new Game purchases preserves idempotent access to a historical order', async () => {
  writes = 0;
  historicalOrder = { id: 10, invoice: 'INV-synthetic-history', type: 'GAME', requestHash: requestDigest(body) };
  try {
    const result = await createCheckout(body, key, 'ID');
    assert.equal(result.order, historicalOrder);
    assert.equal(result.created, false);
    assert.equal(writes, 0);
  } finally { historicalOrder = null; }
});
