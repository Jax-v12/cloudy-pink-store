import { sameOrigin } from '../src/lib/csrf.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { encryptData, decryptData } from '../src/lib/crypto.ts';
import { checkoutInput, parseDetails, requestDigest, checkoutEnabled } from '../src/lib/commerce.ts';
import { verifySignature, getGatewayStatus } from '../src/lib/midtrans.ts';
import { getGameProvider } from '../src/lib/gameProvider.ts';
import { assertSafeDatabaseUrl } from '../src/lib/prisma.ts';
import { clientKey } from '../src/lib/rateLimit.ts';
import { verifyCronAuth } from '../src/lib/auth.ts';
import nextConfig from '../next.config.ts';

process.env.ENCRYPTION_KEY = 'isolated-test-encryption-key';
process.env.MIDTRANS_SERVER_KEY = 'isolated-test-midtrans-key';
test('authenticated encryption protects Apps credentials and rejects tampering', () => {
  const value = JSON.stringify({ emailAccount: 'apps@example.test', passwordAccount: 'secret' });
  const encrypted = encryptData(value);
  assert.equal(decryptData(encrypted), value);
  assert.notEqual(encryptData(value), encrypted);
  const parts = encrypted.split(':'); parts[1] = '0'.repeat(32);
  assert.throws(() => decryptData(parts.join(':')));
});
test('strict category fields and Gamepass URL validation', () => {
  assert.throws(() => checkoutInput({ productId: 1, customerEmail: 'a@b.c', totalAmount: 1 }));
  assert.throws(() => parseDetails('APPS', null, { password: 'secret' }));
  for (const gamepassUrl of ['https://roblox.com.evil.test/game-pass/1','http://roblox.com/game-pass/1','https://roblox.com@evil.test/game-pass/1','https://roblox.com/game-pass/1?redirect=evil','https://127.0.0.1/game-pass/1']) {
    assert.throws(() => parseDetails('ROBLOX', { method: 'GAMEPASS', units: 100, gamepassPrice: 150 }, { username: 'customer', gamepassUrl }));
  }
  const details = parseDetails('ROBLOX', { method: 'GAMEPASS', units: 100, gamepassPrice: 150 }, { username: 'customer', gamepassUrl: 'https://www.roblox.com/game-pass/123/example' });
  assert.equal(details.roblox.gamepassPrice, 143);
  assert.throws(() => parseDetails('ROBLOX', { method: 'LOGIN' }, { username: 'customer', password: 'x', backupCodes: ['1111','1111','1111','1111','1111'] }));
  assert.throws(() => parseDetails('GAME', { requiresZone: true, providerSku: 'x' }, { userId: '123' }));
});
test('canonical request digest is stable and binds checkout details', () => {
  assert.equal(requestDigest({ a: 1, b: 2 }), requestDigest({ b: 2, a: 1 }));
  assert.notEqual(requestDigest({ username: 'customer1' }), requestDigest({ username: 'customer2' }));
});
test('SHA-512 signature and database amount validation are maintained', async () => {
  const body = { order_id: 'INV-test', status_code: '200', gross_amount: '1000.00' };
  body.signature_key = crypto.createHash('sha512').update(body.order_id + body.status_code + body.gross_amount + process.env.MIDTRANS_SERVER_KEY).digest('hex');
  assert.equal(verifySignature(body), true);
  assert.equal(verifySignature({ ...body, gross_amount: '1.00' }), false);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ ...body, currency: 'IDR', transaction_status: 'settlement' });
    await assert.rejects(getGatewayStatus('INV-test', 2000), /GATEWAY_STATUS_UNVERIFIED/);
  } finally { globalThis.fetch = original; }
});
test('simulator reconciles a timeout and production cannot enable it', async () => {
  const old = process.env.NODE_ENV; process.env.NODE_ENV = 'test';
  const provider = getGameProvider('simulator');
  await assert.rejects(provider.send({ reference: 'timeout-1', sku: 'x', userId: '1', zoneId: null }));
  assert.equal((await provider.status('timeout-1')).outcome, 'succeeded');
  process.env.NODE_ENV = 'production'; process.env.GAME_PROVIDER = 'simulator';
  assert.equal(checkoutEnabled('GAME'), false);
  assert.throws(() => getGameProvider('simulator'));
  if (old === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = old;
});

test('CSRF uses browser Host and pins configured proxy origin', () => {
  const prior = process.env.APP_ORIGIN; delete process.env.APP_ORIGIN;
  const req = new Request('http://localhost:3107/api/admin', { headers: { Host: '127.0.0.1:3107', Origin: 'http://127.0.0.1:3107' } });
  assert.equal(sameOrigin(req), true);
  assert.equal(sameOrigin(new Request('http://localhost:3107', { headers: { Host: '127.0.0.1:3107', Origin: 'https://evil.example' } })), false);
  process.env.APP_ORIGIN = 'https://store.example.test';
  assert.equal(sameOrigin(req), false);
  assert.equal(sameOrigin(new Request('http://localhost', { headers: { Origin: 'https://store.example.test' } })), true);
  if (prior === undefined) delete process.env.APP_ORIGIN; else process.env.APP_ORIGIN = prior;
});

test('fail-closed database guard strictly validates protocol, host, and database name with full URL decoding', () => {
  // 1. Missing or empty DATABASE_URL
  assert.throws(() => assertSafeDatabaseUrl(undefined), /FATAL: DATABASE_URL is missing or empty/);
  assert.throws(() => assertSafeDatabaseUrl(''), /FATAL: DATABASE_URL is missing or empty/);
  assert.throws(() => assertSafeDatabaseUrl('   '), /FATAL: DATABASE_URL is missing or empty/);

  // 2. Malformed URLs
  assert.throws(() => assertSafeDatabaseUrl('not-a-valid-url'), /FATAL: DATABASE_URL is malformed/);
  assert.throws(() => assertSafeDatabaseUrl('://malformed'), /FATAL: DATABASE_URL is malformed/);

  // 3. Protocol validation (mysql: only)
  assert.throws(() => assertSafeDatabaseUrl('postgres://avnadmin:pass@host.aivencloud.com:22077/cloudy_staging'), /FATAL: Database protocol must be mysql:/);
  assert.throws(() => assertSafeDatabaseUrl('http://avnadmin:pass@host.aivencloud.com:22077/cloudy_staging'), /FATAL: Database protocol must be mysql:/);

  // 4. Missing database name
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077'), /FATAL: Database name is missing/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/'), /FATAL: Database name is missing/);

  // 5. defaultdb rejection under all conditions (plain, upper, URL-encoded, double-encoded, query string)
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/defaultdb'), /FATAL: Connection to defaultdb is strictly blocked/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/DEFAULTDB'), /FATAL: Connection to defaultdb is strictly blocked/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/default%64b'), /FATAL: Connection to defaultdb is strictly blocked/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/%64efaultdb'), /FATAL: Connection to defaultdb is strictly blocked/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/%64%65%66%61%75%6c%74%64%62'), /FATAL: Connection to defaultdb is strictly blocked/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/%2564efaultdb'), /FATAL: Connection to defaultdb is strictly blocked/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@host.aivencloud.com:22077/cloudy_staging?database=defaultdb'), /FATAL: Connection to defaultdb is strictly blocked/);

  // 6. Aiven policy: cloudy_staging is permitted, all others rejected
  assert.doesNotThrow(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@mysql-store.aivencloud.com:22077/cloudy_staging?ssl-mode=REQUIRED'));
  assert.doesNotThrow(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@mysql-store.aivencloud.com:22077//cloudy_staging?ssl-mode=REQUIRED'));
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@mysql-store.aivencloud.com:22077/cloudy_prod'), /FATAL: Only cloudy_staging is permitted on Aiven/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@mysql-store.aivencloud.com:22077/cloudy_production'), /FATAL: Only cloudy_staging is permitted on Aiven/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://avnadmin:pass@mysql-store.aivencloud.com:22077/test'), /FATAL: Only cloudy_staging is permitted on Aiven/);

  // 7. Local integration test policy: only cloudy_test_* on localhost/127.0.0.1/::1
  assert.doesNotThrow(() => assertSafeDatabaseUrl('mysql://root@localhost:3306/cloudy_test'));
  assert.doesNotThrow(() => assertSafeDatabaseUrl('mysql://root@127.0.0.1:3306/cloudy_test_general'));
  assert.doesNotThrow(() => assertSafeDatabaseUrl('mysql://root@[::1]:3306/cloudy_test_isolation'));
  assert.throws(() => assertSafeDatabaseUrl('mysql://root@127.0.0.1:3306/cloudy_staging'), /FATAL: Only cloudy_test_\* databases are permitted on local hosts/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://root@127.0.0.1:3306/my_database'), /FATAL: Only cloudy_test_\* databases are permitted on local hosts/);
  assert.throws(() => assertSafeDatabaseUrl('mysql://root@127.0.0.1:3306/defaultdb'), /FATAL: Connection to defaultdb is strictly blocked/);

  // 8. Unauthorized hosts fail closed
  assert.throws(() => assertSafeDatabaseUrl('mysql://root@unauthorized-host.com:3306/cloudy_staging'), /FATAL: Unauthorized database host: unauthorized-host.com/);
});

test('clientKey adheres to Vercel boundary, handles IPv4/IPv6, prevents spoofing, and fails closed to shared', () => {
  const priorHeader = process.env.TRUSTED_CLIENT_IP_HEADER;
  const priorVercel = process.env.VERCEL;
  try {
    delete process.env.TRUSTED_CLIENT_IP_HEADER;
    delete process.env.VERCEL;

    // 1. Outside Vercel (unconfigured reverse proxy): all untrusted/spoofed headers fail closed to 'shared'
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-forwarded-for': '1.2.3.4' } })), 'shared');
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-real-ip': '1.2.3.4' } })), 'shared');
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-vercel-id': 'fra1::iad1::v1', 'x-real-ip': '203.0.113.50' } })), 'shared');
    assert.equal(clientKey(new Request('http://localhost')), 'shared');

    // 2. Vercel runtime (VERCEL=1):
    process.env.VERCEL = '1';

    // 2a. Valid IPv4 on Vercel
    const vercelReqV4 = new Request('http://localhost', {
      headers: {
        'x-real-ip': '203.0.113.50',
        'x-forwarded-for': '198.51.100.99, 203.0.113.50', // client spoofed prefix ignored
      },
    });
    assert.equal(clientKey(vercelReqV4), '203.0.113.50');

    // 2b. Valid IPv6 on Vercel (canonicalized)
    const vercelReqV6 = new Request('http://localhost', {
      headers: { 'x-real-ip': '2001:0db8:0000:0000:0000:0000:0000:0001' },
    });
    assert.equal(clientKey(vercelReqV6), '[2001:db8::1]');

    // 2c. Invalid Vercel IP: fails closed to 'shared'
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-real-ip': 'invalid-ip' } })), 'shared');
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-real-ip': '999.999.999.999' } })), 'shared');
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-real-ip': '203.0.113.50:8080' } })), 'shared');

    // 2d. Comma-separated / multi-hop injection in x-real-ip on Vercel: fails closed to 'shared'
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.1, 203.0.113.50' } })), 'shared');

    // 2e. Missing x-real-ip on Vercel: fails closed to 'shared'
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-forwarded-for': '203.0.113.50' } })), 'shared');

    // 2f. On Vercel, invalid/missing x-real-ip MUST NEVER fall back to TRUSTED_CLIENT_IP_HEADER
    process.env.TRUSTED_CLIENT_IP_HEADER = 'cf-connecting-ip';
    const vercelBypassAttempt = new Request('http://localhost', {
      headers: {
        'cf-connecting-ip': '198.51.100.77', // attacker trying to trigger fallback
        'x-real-ip': 'invalid-ip',
      },
    });
    assert.equal(clientKey(vercelBypassAttempt), 'shared');

    const vercelMissingFallbackAttempt = new Request('http://localhost', {
      headers: {
        'cf-connecting-ip': '198.51.100.77', // no x-real-ip header present
      },
    });
    assert.equal(clientKey(vercelMissingFallbackAttempt), 'shared');

    // 3. Non-Vercel hosting with operator-configured TRUSTED_CLIENT_IP_HEADER:
    delete process.env.VERCEL;
    process.env.TRUSTED_CLIENT_IP_HEADER = 'cf-connecting-ip';

    // 3a. Single valid IPv4 header from trusted proxy
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'cf-connecting-ip': '198.51.100.44' } })), '198.51.100.44');

    // 3b. Single valid IPv6 header from trusted proxy
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'cf-connecting-ip': '2001:db8::2' } })), '[2001:db8::2]');

    // 3c. Multi-hop / comma-separated header: ambiguous chain is rejected, fails closed to 'shared'
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'cf-connecting-ip': '10.0.0.1, 198.51.100.44' } })), 'shared');

    // 3d. Malformed or invalid IP in configured header
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'cf-connecting-ip': 'not-an-ip' } })), 'shared');

    // 3e. Header missing from request: fails closed to 'shared'
    assert.equal(clientKey(new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.44' } })), 'shared');
  } finally {
    if (priorHeader === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER;
    else process.env.TRUSTED_CLIENT_IP_HEADER = priorHeader;
    if (priorVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = priorVercel;
  }
});

test('verifyCronAuth enforces constant-time comparison and requires valid Bearer token', () => {
  const prior = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = 'super-secret-cron-token-123';
    const validReq = new Request('http://localhost/api/cron/cleanup', {
      headers: { authorization: 'Bearer super-secret-cron-token-123' },
    });
    assert.equal(verifyCronAuth(validReq), true);

    const invalidReq = new Request('http://localhost/api/cron/cleanup', {
      headers: { authorization: 'Bearer wrong-cron-token' },
    });
    assert.equal(verifyCronAuth(invalidReq), false);

    const noBearerReq = new Request('http://localhost/api/cron/cleanup', {
      headers: { authorization: 'super-secret-cron-token-123' },
    });
    assert.equal(verifyCronAuth(noBearerReq), false);

    const missingReq = new Request('http://localhost/api/cron/cleanup');
    assert.equal(verifyCronAuth(missingReq), false);

    delete process.env.CRON_SECRET;
    assert.equal(verifyCronAuth(validReq), false);
  } finally {
    if (prior === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prior;
  }
});

test('next.config.ts configures mandatory HTTP security headers, Midtrans allowlist, and CSP', async () => {
  assert.ok(typeof nextConfig.headers === 'function');
  const headersList = await nextConfig.headers();
  const globalRule = headersList.find(h => h.source === '/(.*)');
  assert.ok(globalRule);
  const headerKeys = globalRule.headers.map(h => h.key);
  assert.ok(headerKeys.includes('Content-Security-Policy'));
  assert.ok(headerKeys.includes('X-Frame-Options'));
  assert.ok(headerKeys.includes('X-Content-Type-Options'));
  assert.ok(headerKeys.includes('Referrer-Policy'));
  assert.ok(headerKeys.includes('Permissions-Policy'));
  assert.ok(headerKeys.includes('Strict-Transport-Security'));

  const csp = globalRule.headers.find(h => h.key === 'Content-Security-Policy')?.value;
  assert.ok(csp);
  assert.ok(csp.includes("img-src 'self' data: blob: https://*.rbxcdn.com https://thumbnails.roblox.com https://api.sandbox.midtrans.com https://api.midtrans.com"));
  assert.ok(csp.includes("connect-src 'self' https://api.sandbox.midtrans.com https://api.midtrans.com"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
});
