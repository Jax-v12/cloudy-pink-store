import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAppsConfig, appsWarranty, parseCatalogResponse, catalogFilters, appsDeliveryVisible, APPS_DELIVERY_TTL_MS } from '../src/lib/appsProduct.ts';
import { orderProgress, orderNotice } from '../src/lib/orderNotice.ts';
import { publicSiteOrigin } from '../src/lib/siteMetadata.ts';

export const config = { version: 1, appGroup: 'music', accountType: 'Private', durationDays: 30,
  devices: 'One device', regionRules: 'ID', usageRules: 'Do not change account settings',
  included: 'Premium access', instructions: 'Use the authorized invoice', warrantyDays: 20,
  warrantyTerms: 'Access issues are reviewed during coverage', fulfillmentMode: 'READY_ACCOUNT', activationMethod: null };

test('Apps config keeps legacy stock mode implicit and rejects malformed or secret fields', () => {
  assert.equal(parseAppsConfig(null), null);
  assert.deepEqual(parseAppsConfig(config), config);
  for (const changed of [{ warrantyDays: -1 }, { durationDays: 0 }, { fulfillmentMode: 'OTHER' },
    { password: 'must-not-be-accepted' }, { activationMethod: 'LINK' }, { appGroup: '' }]) {
    assert.throws(() => parseAppsConfig({ ...config, ...changed }));
  }
  assert.equal(parseAppsConfig({ ...config, fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' }).activationMethod, 'INVITATION');
});

test('warranty uses purchase snapshot, expires at boundary and never invents a legacy paid date', () => {
  const paidAt = new Date('2026-10-01T00:00:00Z');
  const snapshot = structuredClone(config);
  const edited = { ...config, warrantyDays: 99 };
  assert.equal(appsWarranty(snapshot, paidAt, null, new Date('2026-10-20')).active, true);
  assert.equal(appsWarranty(snapshot, paidAt, null, new Date('2026-10-21')).active, false);
  assert.equal(appsWarranty(edited, paidAt, null, new Date('2026-10-21')).active, true);
  assert.equal(appsWarranty(null, null, null).expiresAt, null);
  assert.equal(appsWarranty(null, paidAt, null, new Date('2026-10-02')).days, 25);
  assert.equal(appsWarranty({ ...config, fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' }, paidAt, null).active, false);
  assert.equal(appsWarranty({ ...config, fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' }, paidAt, new Date('2026-11-01'), new Date('2026-10-20')).active, false);
});

test('public sitemap origin cannot be credentials, a local host, or a URL with private parameters', () => {
  assert.equal(publicSiteOrigin('https://store.example.test'), 'https://store.example.test');
  for (const url of ['http://store.example.test', 'https://user:pass@store.example.test', 'https://localhost', 'https://127.0.0.1', 'https://store.example.test/?token=secret', 'https://store.example.test/private']) assert.equal(publicSiteOrigin(url), null);
});
test('cached Apps delivery is hidden at expiry, for invalid dates and for future timestamps', () => {
  const time = Date.parse('2026-10-19T00:00:00Z');
  assert.equal(appsDeliveryVisible(new Date(time), time + APPS_DELIVERY_TTL_MS - 1), true);
  assert.equal(appsDeliveryVisible(new Date(time), time + APPS_DELIVERY_TTL_MS), false);
  assert.equal(appsDeliveryVisible('invalid', time), false);
  assert.equal(appsDeliveryVisible(new Date(time + 1000), time), false);
});

test('first catalog load rejects HTTP failure, explicit failure and malformed pages instead of false empty', async () => {
  for (const response of [Response.json({ success: false }), Response.json({ success: false }, { status: 500 }),
    Response.json({ success: true, data: null }), Response.json({ success: true, data: [], pagination: { nextCursor: 'bad' } })]) {
    await assert.rejects(parseCatalogResponse(response));
  }
  assert.deepEqual(await parseCatalogResponse(Response.json({ success: true, data: [], pagination: { nextCursor: null } })), { data: [], nextCursor: null });
});

test('server search and category filters compose before pagination and reject unbounded input', () => {
  assert.deepEqual(catalogFilters(new URLSearchParams('q=Spotify&category=Music')), { name: { contains: 'Spotify' }, category: 'Music' });
  assert.throws(() => catalogFilters(new URLSearchParams({ q: 'x'.repeat(101) })));
  assert.throws(() => catalogFilters(new URLSearchParams({ category: 'x'.repeat(51) })));
});

test('paid Apps activation tracks fulfillment instead of falsely requiring delivered stock', () => {
  const order = { type: 'APPS', status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: 'QUEUED', account: null, qrisUrl: null, appsSnapshot: { fulfillmentMode: 'ACTIVATION' } };
  assert.equal(orderProgress(order).stage, 'queued');
  assert.equal(orderNotice(order), 'queued');
  assert.equal(orderProgress({ ...order, fulfillmentStatus: 'COMPLETED' }).stage, 'completed');
});
