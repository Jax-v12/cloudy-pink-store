import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveRequestRegion } from '../src/lib/requestRegion.ts';
import { geoHeaders, geoSecret, geoAudience } from './geo-fixture.mjs';

const url = 'https://store.test/api/checkout/quote';

test('only authenticated request-scoped ingress country can resolve a region', () => {
  const envSnapshot = { ...process.env };
  try {
    Object.assign(process.env, { GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret, GEOIP_INGRESS_AUDIENCE: geoAudience });
    delete process.env.VERCEL;

    for (const region of ['ID', 'MY', 'PH']) {
      const headers = geoHeaders(url, region);
      assert.deepEqual(resolveRequestRegion(new Request(url, { headers })), { region, reason: 'detected' });
      assert.equal(resolveRequestRegion(new Request(url, { headers: { ...headers, 'x-store-geo-country': 'US' } })).region, null);
      assert.equal(resolveRequestRegion(new Request(url + '?region=ID', { headers })).region, null);
      assert.equal(resolveRequestRegion(new Request(url, { method: 'POST', headers })).region, null);
    }
    assert.deepEqual(resolveRequestRegion(new Request(url, { headers: geoHeaders(url, 'US') })), { region: null, reason: 'unsupported' });
    for (const delta of [-61_000, 61_000]) {
      assert.equal(resolveRequestRegion(new Request(url, { headers: geoHeaders(url, 'ID', 'GET', String(Date.now() + delta)) })).region, null);
    }
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
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in envSnapshot)) delete process.env[k];
    }
    Object.assign(process.env, envSnapshot);
  }
});

test('invalid or unrecognized GEOIP_SOURCE configurations always fail closed', () => {
  const envSnapshot = { ...process.env };
  try {
    delete process.env.VERCEL;
    for (const badSource of ['unknown', 'cloudflare', 'signed_ingress', 'custom-proxy', 'true', '1']) {
      process.env.GEOIP_SOURCE = badSource;
      const headers = geoHeaders(url, 'ID');
      assert.deepEqual(resolveRequestRegion(new Request(url, { headers })), { region: null, reason: 'unverified' });

      const vercelHeaders = { 'x-vercel-id': 'sin1::bom1::trace-1', 'x-vercel-ip-country': 'ID' };
      assert.deepEqual(resolveRequestRegion(new Request(url, { headers: vercelHeaders })), { region: null, reason: 'unverified' });
    }
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in envSnapshot)) delete process.env[k];
    }
    Object.assign(process.env, envSnapshot);
  }
});

test('Vercel Edge boundary mode resolves regions only when VERCEL=1 is active and fails closed without trusted headers or outside Vercel', () => {
  const envSnapshot = { ...process.env };
  try {
    delete process.env.GEOIP_SOURCE;
    const testVercelId = 'sin1::bom1::req-test-12345';

    // 1. Outside Vercel (VERCEL is not '1'), client-supplied x-vercel headers must fail closed
    delete process.env.VERCEL;
    const directReq = new Request(url, {
      headers: { 'x-vercel-id': testVercelId, 'x-vercel-ip-country': 'ID' },
    });
    assert.deepEqual(resolveRequestRegion(directReq), { region: null, reason: 'unverified' });

    // 2. Request without any headers must fail closed
    assert.deepEqual(resolveRequestRegion(new Request(url, { headers: {} })), { region: null, reason: 'unverified' });

    // 3. Inside Vercel environment (VERCEL=1 simulated in isolated scope)
    process.env.VERCEL = '1';

    // 3a. Resolves supported regions
    for (const region of ['ID', 'MY', 'PH']) {
      const headers = { 'x-vercel-id': testVercelId, 'x-vercel-ip-country': region };
      assert.deepEqual(resolveRequestRegion(new Request(url, { headers })), { region, reason: 'detected' });
    }

    // 3b. Unsupported countries fail closed with reason 'unsupported'
    for (const country of ['US', 'SG', 'JP', 'GB', 'AU']) {
      const headers = { 'x-vercel-id': testVercelId, 'x-vercel-ip-country': country };
      assert.deepEqual(resolveRequestRegion(new Request(url, { headers })), { region: null, reason: 'unsupported' });
    }

    // 3c. Missing x-vercel-id fails closed with reason 'unverified'
    assert.deepEqual(resolveRequestRegion(new Request(url, { headers: { 'x-vercel-ip-country': 'ID' } })), { region: null, reason: 'unverified' });

    // 3d. Missing or malformed country codes fail closed
    for (const invalidCountry of ['', 'id', 'IDR', '12', 'INDONESIA', 'I', 'ID1']) {
      const headers = { 'x-vercel-id': testVercelId, 'x-vercel-ip-country': invalidCountry };
      assert.deepEqual(resolveRequestRegion(new Request(url, { headers })), { region: null, reason: 'unverified' });
    }

    // 3e. Ignores client spoof vectors (query params, cookies, proxy headers)
    const spoofVectors = [
      { headers: { 'cf-ipcountry': 'ID', 'x-forwarded-for': '1.1.1.1' }, query: '?region=ID&country=ID' },
      { headers: { cookie: 'region=ID; pricingRegion=ID; regionCorrection=ID', 'accept-language': 'id-ID' } },
      { headers: { 'x-real-ip': '8.8.8.8', 'x-client-ip': '1.2.3.4' } },
    ];
    for (const vector of spoofVectors) {
      const reqUrl = url + (vector.query || '');
      assert.deepEqual(resolveRequestRegion(new Request(reqUrl, { headers: vector.headers })), { region: null, reason: 'unverified' });
    }

    // 3f. Client cannot override detected region with query parameters or cookies when Vercel headers are present
    const spoofedReq = new Request(url + '?region=MY&country=MY', {
      headers: {
        'x-vercel-id': testVercelId,
        'x-vercel-ip-country': 'ID',
        cookie: 'region=MY; pricingRegion=MY',
      },
    });
    assert.deepEqual(resolveRequestRegion(spoofedReq), { region: 'ID', reason: 'detected' });

    // 4. Explicit GEOIP_SOURCE='vercel' works when VERCEL=1 and fails closed when VERCEL is not '1'
    process.env.GEOIP_SOURCE = 'vercel';
    assert.deepEqual(resolveRequestRegion(new Request(url, { headers: { 'x-vercel-id': testVercelId, 'x-vercel-ip-country': 'ID' } })), { region: 'ID', reason: 'detected' });

    delete process.env.VERCEL;
    assert.deepEqual(resolveRequestRegion(new Request(url, { headers: { 'x-vercel-id': testVercelId, 'x-vercel-ip-country': 'ID' } })), { region: null, reason: 'unverified' });
  } finally {
    for (const k of Object.keys(process.env)) {
      if (!(k in envSnapshot)) delete process.env[k];
    }
    Object.assign(process.env, envSnapshot);
  }
});

