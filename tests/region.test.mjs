import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRequestRegion } from '../src/lib/requestRegion.ts';
import { geoHeaders, geoSecret, geoAudience } from './geo-fixture.mjs';

const url = 'https://store.test/api/checkout/quote';
test('only authenticated request-scoped ingress country can resolve a region', () => {
  Object.assign(process.env, { GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret, GEOIP_INGRESS_AUDIENCE: geoAudience });
  for (const region of ['ID', 'MY', 'PH']) {
    const headers = geoHeaders(url, region);
    assert.deepEqual(resolveRequestRegion(new Request(url, { headers })), { region, reason: 'detected' });
    assert.equal(resolveRequestRegion(new Request(url, { headers: { ...headers, 'x-store-geo-country': 'US' } })).region, null);
    assert.equal(resolveRequestRegion(new Request(url + '?region=ID', { headers })).region, null);
    assert.equal(resolveRequestRegion(new Request(url, { method: 'POST', headers })).region, null);
  }
  assert.deepEqual(resolveRequestRegion(new Request(url, { headers: geoHeaders(url, 'US') })), { region: null, reason: 'unsupported' });
  for (const delta of [-61_000, 61_000]) assert.equal(resolveRequestRegion(new Request(url, { headers: geoHeaders(url, 'ID', 'GET', String(Date.now() + delta)) })).region, null);
  for (const headers of [{}, { 'cf-ipcountry': 'ID', 'x-vercel-ip-country': 'ID', 'x-forwarded-for': '1.1.1.1' },
    { cookie: 'region=ID; pricingRegion=ID; regionCorrection=ID', 'accept-language': 'id-ID' },
    { 'x-store-geo-country': 'ID', 'x-store-geo-timestamp': String(Date.now()), 'x-store-geo-signature': '0'.repeat(64) }]) {
    assert.equal(resolveRequestRegion(new Request(url + '?region=ID&country=ID', { headers })).region, null);
  }
  process.env.GEOIP_INGRESS_AUDIENCE = 'other-store';
  assert.equal(resolveRequestRegion(new Request(url, { headers: geoHeaders(url) })).region, null);
  process.env.GEOIP_INGRESS_AUDIENCE = geoAudience;
  process.env.GEOIP_INGRESS_SECRET = 'short';
  assert.equal(resolveRequestRegion(new Request(url, { headers: geoHeaders(url) })).region, null);
  process.env.GEOIP_INGRESS_SECRET = geoSecret;
  delete process.env.GEOIP_SOURCE;
  assert.equal(resolveRequestRegion(new Request(url, { headers: geoHeaders(url) })).region, null, 'local/ngrok defaults to unavailable');
});
