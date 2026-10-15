import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { mockRoblox } from './roblox-fixture.mjs';

// No PrismaClient, database, provider or real recipient is used in this fixture.
process.env.ENCRYPTION_KEY = 'synthetic-attempt-encryption';
process.env.CHECKOUT_HASH_KEY = 'synthetic-attempt-hash';
process.env.MIDTRANS_SERVER_KEY = 'synthetic-attempt-provider';
process.env.ROBLOX_CHECKOUT_ENABLED = 'true';
let data, clock, tail = Promise.resolve(), loseCommitResponse = false, failCommitAudit = false, loseSessionCommitResponse = false;
const sessionId = crypto.randomUUID(), otherSessionId = crypto.randomUUID();
const cookie = crypto.randomBytes(32).toString('base64url');
const variant = { id: 2, productId: 1, active: true, method: 'LOGIN', units: 100, price: 7000, maxUnits: null, unitStep: 1, regionalPrices: [] };
const product = { id: 1, active: true, type: 'ROBLOX', name: 'Fixture', price: 0, variants: [variant] };
function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'sessionId_flowId') return row.sessionId === value.sessionId && row.flowId === value.flowId;
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      if ('in' in value) return value.in.includes(row[key]);
      if ('gt' in value) return row[key] > value.gt;
      if ('is' in value) return Boolean(row[key]) && matches(row[key], value.is);
    }
    return row[key] === value;
  });
}
function view(name, row, args) {
  if (!row || name !== 'orders') return row;
  const linked = data.attempts.find(value => value.orderId === row.id);
  const expanded = { ...row, product: { name: 'Fixture' }, accountStock: null, gameDetail: null,
    robloxDetail: row.robloxDetail?.create ?? row.robloxDetail,
    checkoutAttempt: linked ? { ...linked, session: data.sessions.find(value => value.id === linked.sessionId) } : null };
  if (args?.include?.robloxDetail?.select && expanded.robloxDetail) {
    expanded.robloxDetail = Object.fromEntries(Object.keys(args.include.robloxDetail.select).map(key => [key, expanded.robloxDetail[key]]));
  }
  return expanded;
}
function table(name) {
  return {
    findUnique: async args => view(name, data[name].find(row => matches(row, args.where)) ?? null, args),
    findUniqueOrThrow: async args => {
      const row = data[name].find(row => matches(row, args.where)); assert.ok(row); return view(name, row, args);
    },
    findFirst: async args => {
      const { where, orderBy } = args;
      const rows = data[name].filter(row => matches(view(name, row), where));
      if (orderBy) rows.sort((a,b) => b.createdAt - a.createdAt || b.id.localeCompare(a.id));
      return view(name, rows[0] ?? null, args);
    },
    create: async ({ data: value }) => {
      if (name === 'sessions' && data.sessions.some(row => row.id === value.id || row.tokenHash === value.tokenHash)) throw Object.assign(new Error('synthetic unique conflict'), { code: 'P2002' });
      const row = { id: name === 'orders' ? data[name].length + 1 : crypto.randomUUID(), createdAt: new Date(clock), updatedAt: new Date(clock),
        state: 'READY', version: 0, requestHash: null, quoteSnapshot: null, leaseUntil: null, orderId: null, ...value };
      if (name === 'orders') Object.assign(row, { status: 'PENDING', qrisUrl: null, paymentReference: null, accessToken: crypto.randomBytes(32).toString('hex') });
      data[name].push(row); return row;
    },
    update: async ({ where, data: changes }) => {
      if (name === 'attempts' && changes.state === 'COMMITTED' && failCommitAudit) throw Object.assign(new Error('synthetic transaction timeout'), { code: 'P2028' });
      const row = data[name].find(row => matches(row, where)); assert.ok(row);
      Object.assign(row, changes); return row;
    },
  };
}
const db = {
  checkoutSession: table('sessions'), checkoutAttempt: table('attempts'), order: table('orders'),
  productVariant: { findFirst: async ({ where }) => product.variants.find(value => where.id === value.id && where.productId === product.id && value.active) ?? null },
  product: { findUnique: async () => product },
  rateLimit: { upsert: async () => ({ points: 1 }) },
  $queryRaw: async (strings) => strings.join('').includes('CURRENT_TIMESTAMP') ? [{ now: new Date(clock) }] : [],
  $transaction: async callback => {
    const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
    const before = structuredClone(data);
    try {
      const result = await callback(db);
      if (loseSessionCommitResponse && data.sessions.length > before.sessions.length) {
        loseSessionCommitResponse = false;
        throw Object.assign(new Error('synthetic lost session acknowledgement'), { code: 'P1017', committedFixture: true });
      }
      if (loseCommitResponse && data.orders.length > before.orders.length) {
        loseCommitResponse = false;
        const error = Object.assign(new Error('synthetic lost commit response'), { code: 'P1017' });
        // Simulate committed data with a lost acknowledgement; do not roll it back.
        error.committedFixture = true; throw error;
      }
      return result;
    } catch (error) { if (!error.committedFixture) data = before; throw error; }
    finally { release(); }
  },
};
globalThis.prisma = db;
const attempt = await import('../src/lib/checkoutAttempt.ts');
const session = await import('../src/lib/checkoutSession.ts');
const { confirmLoginAttempt } = await import('../src/lib/loginAttemptCheckout.ts');
const { checkoutPricing, checkoutQuoteToken } = await import('../src/lib/checkoutPricing.ts');
const { decryptData } = await import('../src/lib/crypto.ts');
const restore = mockRoblox(true);
test.after(() => { restore(); delete globalThis.prisma; });
test.beforeEach(() => {
  clock = Date.now(); variant.price = 7000; variant.active = true; loseCommitResponse = false; failCommitAudit = false; loseSessionCommitResponse = false;
  product.variants.splice(1);
  data = { sessions: [{ id: sessionId, tokenHash: crypto.createHash('sha256').update(cookie).digest('hex'), createdAt: new Date(clock), expiresAt: new Date(clock + 30 * 86400_000), revokedAt: null },
    { id: otherSessionId, tokenHash: 'unmatchable', createdAt: new Date(clock), expiresAt: new Date(clock + 30 * 86400_000), revokedAt: null }], attempts: [], orders: [] };
});
const input = () => ({ productId: 1, variantId: 2, customerEmail: 'fixture@example.invalid', paymentMethod: 'QRIS',
  quoteToken: checkoutQuoteToken(1, 2, checkoutPricing('ROBLOX', 0, variant, 'ID', 'QRIS')),
  details: { username: 'FixtureUser', whatsappE164: '+12133734253' } });
const start = (flowId = crypto.randomUUID(), previousFlowId) => attempt.openLoginAttempt(sessionId, { productId: 1, variantId: 2, flowId, previousFlowId });

test('migration contains only two additive CREATE statements and restrictive foreign keys', () => {
  const sql = fs.readFileSync(new URL('../prisma/migrations/202610150001_checkout_attempts/migration.sql', import.meta.url), 'utf8').replace(/^--.*$/gm, '');
  const statements = sql.split(';').map(value => value.trim()).filter(Boolean);
  assert.equal(statements.length, 2);
  assert.ok(statements.every(value => /^CREATE TABLE `Checkout(?:Session|Attempt)`/.test(value)));
  assert.equal((sql.match(/ON DELETE RESTRICT/g) ?? []).length, 2);
  for (const index of ['CheckoutSession_tokenHash_key', 'CheckoutAttempt_checkoutKey_key', 'CheckoutAttempt_orderId_key', 'CheckoutAttempt_sessionId_flowId_key']) assert.ok(sql.includes(index));
  assert.ok(sql.includes('`quoteSnapshot` JSON NULL')); assert.ok(!sql.includes('bootstrapId'));
});
test('cookie is the only session credential; no issuance or renewal occurs', async () => {
  const request = headers => new Request('https://store.invalid/api/checkout/attempts', { method: 'POST', headers });
  const valid = { cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid' };
  assert.equal((await session.checkoutSessionAccess(request(valid), true)).id, sessionId);
  await assert.rejects(session.checkoutSessionAccess(request({ origin: valid.origin, 'x-flow-id': crypto.randomUUID() }), true), /CHECKOUT_SESSION_REQUIRED/);
  await assert.rejects(session.checkoutSessionAccess(request({ ...valid, origin: 'https://attacker.invalid' }), true), /CSRF_REJECTED/);
  await assert.rejects(session.checkoutSessionAccess(request({ ...valid, cookie: `${valid.cookie}; ${valid.cookie}` }), true), /CHECKOUT_SESSION_REQUIRED/);
  data.sessions[0].revokedAt = new Date(clock);
  await assert.rejects(session.checkoutSessionAccess(request(valid), true), /CHECKOUT_SESSION_REQUIRED/);
});
test('simultaneous tabs join one attempt; a public flow locator never transfers ownership', async () => {
  const [first, second] = await Promise.all([start(), start()]);
  assert.equal(first.flowId, second.flowId); assert.equal(data.attempts.length, 1); assert.equal(data.orders.length, 0);
  await assert.rejects(attempt.recoverLoginAttempt(otherSessionId, first.flowId), /ATTEMPT_NOT_FOUND/);
  assert.equal('checkoutKey' in first, false); assert.equal('requestHash' in first, false);
});
test('commit + lost response + refresh resolves the same invoice without request contacts', async () => {
  const first = await start(); loseCommitResponse = true;
  await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID'), /CHECKOUT_UNKNOWN/);
  variant.price = 9000;
  const refreshed = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  assert.equal(refreshed.outcome, 'COMMITTED'); assert.equal(data.orders.length, 1);
  const replay = await confirmLoginAttempt(sessionId, first.flowId, first.version, input(), null);
  assert.equal(replay.created, false); assert.equal(replay.order.invoice, refreshed.invoice);
  assert.equal(data.orders.length, 1); assert.equal((await start()).flowId, first.flowId);
  assert.equal(decryptData(data.orders[0].robloxDetail.create.whatsappE164), '+12133734253');
  assert.equal(JSON.stringify(data.attempts).includes('fixture@example.invalid'), false);
  assert.equal(JSON.stringify(data.attempts).includes('+12133734253'), false);
});
test('lease expiry alone is UNKNOWN; recovery fences the old claimant before NOT_COMMITTED', async () => {
  const first = await start(); const body = input();
  const claimed = await attempt.claimLoginAttempt(sessionId, first.flowId, first.version, body);
  clock += attempt.ATTEMPT_LEASE_MS + 1;
  assert.equal(attempt.attemptDto(data.attempts[0]).outcome, 'UNKNOWN');
  const recovered = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  assert.equal(recovered.outcome, 'NOT_COMMITTED'); assert.ok(recovered.version > claimed.version);
  // Once a replacement claim is live, state/lease/hash all match again. Only
  // the version fence distinguishes the old request from the authorized retry.
  const replacement = await attempt.claimLoginAttempt(sessionId, first.flowId, recovered.version, body);
  assert.equal(replacement.checkoutKey, claimed.checkoutKey);
  const { createCheckout } = await import('../src/lib/checkout.ts');
  await assert.rejects(createCheckout(body, claimed.checkoutKey, 'ID', { sessionId, flowId: first.flowId, version: claimed.version }), /ATTEMPT_FENCED/);
  assert.equal(data.orders.length, 0);
  await createCheckout(body, replacement.checkoutKey, 'ID', { sessionId, flowId: first.flowId, version: replacement.version });
  assert.equal(data.orders.length, 1);
});
test('UNKNOWN blocks a new flow and double submit; committed replay creates one logical order', async () => {
  const first = await start(); const body = input();
  const settled = await Promise.allSettled([confirmLoginAttempt(sessionId, first.flowId, first.version, body, 'ID'), confirmLoginAttempt(sessionId, first.flowId, first.version, body, 'ID')]);
  assert.ok(settled.some(row => row.status === 'fulfilled'));
  assert.equal(data.orders.length, 1);
  assert.equal((await start()).flowId, first.flowId);
  const again = await start(crypto.randomUUID(), first.flowId);
  assert.notEqual(again.flowId, first.flowId); assert.equal(data.orders.length, 1);
});
test('safe retry keeps original key; changed quote needs explicit confirmation after fencing', async () => {
  const first = await start(); const original = input();
  const claimed = await attempt.claimLoginAttempt(sessionId, first.flowId, first.version, original);
  clock += attempt.ATTEMPT_LEASE_MS + 1;
  const recovered = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  variant.price = 8000;
  await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, recovered.version, input(), 'ID'), /RECONFIRM_REQUIRED/);
  await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, recovered.version, original, 'ID'), /PRICE_CHANGED/);
  const safe = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  const result = await confirmLoginAttempt(sessionId, first.flowId, safe.version, input(), 'ID', true);
  assert.equal(result.order.checkoutKey, claimed.checkoutKey); assert.equal(data.orders.length, 1);
  assert.equal(result.order.totalAmount, 8000);
});
test('expiry cancels no committed financial history and fences outstanding work', async () => {
  const first = await start(); const claimed = await attempt.claimLoginAttempt(sessionId, first.flowId, first.version, input());
  clock += attempt.ATTEMPT_TTL_MS + 1;
  const expired = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  assert.equal(expired.outcome, 'EXPIRED'); assert.ok(expired.version > claimed.version);
  await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, expired.version, input(), 'ID'), /ATTEMPT_EXPIRED/);
  assert.equal(data.orders.length, 0);
});
test('a live claimant may commit before recover obtains the barrier; recovery returns COMMITTED', async () => {
  const first = await start(); await confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID');
  clock += attempt.ATTEMPT_TTL_MS + 1;
  assert.equal((await attempt.recoverLoginAttempt(sessionId, first.flowId)).outcome, 'COMMITTED');
  assert.equal(data.orders.length, 1);
});
test('session expiry/revocation is rechecked after lock acquisition', async () => {
  const first = await start(); data.sessions[0].expiresAt = new Date(clock - 1);
  await assert.rejects(attempt.claimLoginAttempt(sessionId, first.flowId, first.version, input()), /CHECKOUT_SESSION_REQUIRED/);
  assert.equal(data.orders.length, 0);
});
test('cookie invoice bridge is narrow; explicit bad legacy header never falls back', async () => {
  const { invoiceAccessWhere } = await import('../src/lib/invoiceAccess.ts');
  const req = (headers = {}, method = 'GET') => new Request('https://store.invalid/api/orders/INV-fixture', { method, headers });
  const base = { cookie: `${session.CHECKOUT_COOKIE}=${cookie}` };
  const where = await invoiceAccessWhere(req(base), 'INV-fixture');
  assert.equal(where.type, 'ROBLOX'); assert.equal(where.checkoutAttempt.is.state, 'COMMITTED');
  assert.equal(where.checkoutAttempt.is.session.is.tokenHash, data.sessions[0].tokenHash);
  const invalid = await invoiceAccessWhere(req({ ...base, 'x-order-token': '' }), 'INV-fixture');
  assert.equal(invalid, null);
  const explicit = await invoiceAccessWhere(req({ ...base, 'x-order-token': 'invalid-explicit' }), 'INV-fixture');
  assert.deepEqual(explicit, { invoice: 'INV-fixture', accessToken: 'invalid-explicit' });
  await assert.rejects(invoiceAccessWhere(req({ ...base, origin: 'https://attacker.invalid' }, 'POST'), 'INV-fixture', true), /CSRF_REJECTED/);
});

test('public legacy checkout refuses new Login, preserves historical replay, and rejects attempt-key replay', async () => {
  const { createLegacyCheckout } = await import('../src/lib/checkout.ts');
  await assert.rejects(createLegacyCheckout(input(), crypto.randomUUID(), 'ID'), /CHECKOUT_SESSION_REQUIRED/);
  assert.equal(data.orders.length, 0);
  const { checkoutInput, requestDigest } = await import('../src/lib/commerce.ts');
  const original = input(), key = crypto.randomUUID();
  data.orders.push({ id: 90, invoice: 'INV-HISTORICAL', checkoutKey: key, requestHash: requestDigest(checkoutInput(original)) });
  variant.price = 9000;
  const replay = await createLegacyCheckout(original, key, null);
  assert.equal(replay.created, false); assert.equal(replay.order.invoice, 'INV-HISTORICAL');
  data.orders = [];
  const first = await start(); const result = await confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID');
  await assert.rejects(createLegacyCheckout(input(), result.order.checkoutKey, 'ID'), /CHECKOUT_SESSION_REQUIRED/);
  assert.equal(data.orders.length, 1);
});
test('failure writing COMMITTED rolls back Order and encrypted details together', async () => {
  const first = await start(); failCommitAudit = true;
  await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID'), /CHECKOUT_UNKNOWN/);
  assert.equal(data.orders.length, 0); assert.equal(data.attempts[0].state, 'PROCESSING');
  assert.equal((await attempt.recoverLoginAttempt(sessionId, first.flowId)).outcome, 'UNKNOWN');
  assert.equal((await start()).flowId, first.flowId);
  clock += attempt.ATTEMPT_LEASE_MS + 1;
  const recovered = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  failCommitAudit = false;
  await confirmLoginAttempt(sessionId, first.flowId, recovered.version, input(), 'ID');
  assert.equal(data.orders.length, 1);
});
test('UNKNOWN can become a late COMMITTED result; no second tab can create a new intent meanwhile', async () => {
  const first = await start(); const previousFetch = globalThis.fetch;
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  globalThis.fetch = async (url, init) => { entered(); await gate; return previousFetch(url, init); };
  try {
    const pending = confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID');
    await started;
    assert.equal((await attempt.recoverLoginAttempt(sessionId, first.flowId)).outcome, 'UNKNOWN');
    assert.equal((await start()).flowId, first.flowId);
    release(); await pending;
    assert.equal((await attempt.recoverLoginAttempt(sessionId, first.flowId)).outcome, 'COMMITTED');
    assert.equal(data.orders.length, 1);
  } finally { release(); globalThis.fetch = previousFetch; }
});
test('MY/PH and price null fail closed without IDR fallback or an Order', async () => {
  const first = await start(); const body = input();
  for (const region of ['MY', 'PH']) {
    const current = await attempt.recoverLoginAttempt(sessionId, first.flowId);
    await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, current.version, body, region), /REGIONAL_PRICE_UNAVAILABLE/);
  }
  assert.equal(data.orders.length, 0);
  const current = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  await assert.rejects(confirmLoginAttempt(sessionId, first.flowId, current.version, body, null), /REGION_UNVERIFIED/);
  assert.equal(data.orders.length, 0);
});
test('absolute session lifetime cannot be extended by a later expiresAt', async () => {
  const first = await start();
  data.sessions[0].createdAt = new Date(clock - session.CHECKOUT_SESSION_TTL_MS - 1);
  data.sessions[0].expiresAt = new Date(clock + session.CHECKOUT_SESSION_TTL_MS);
  await assert.rejects(attempt.recoverLoginAttempt(sessionId, first.flowId), /CHECKOUT_SESSION_REQUIRED/);
  assert.equal(data.orders.length, 0);
});
test('actual attempt handlers require cookie+Origin and never issue a credential for flowId', async () => {
  const { POST: open } = await import('../src/app/api/checkout/attempts/route.ts');
  const flowId = crypto.randomUUID(); const body = { flowId, productId: 1, variantId: 2 };
  const req = headers => new Request('https://store.invalid/api/checkout/attempts', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const missing = await open(req({ origin: 'https://store.invalid' })); assert.equal(missing.status, 401); assert.equal(missing.headers.has('set-cookie'), false);
  const auth = { cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid' };
  const blocked = await open(req({ ...auth, origin: 'https://attacker.invalid' })); assert.equal(blocked.status, 403);
  const response = await open(req(auth)); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const json = await response.json(); assert.equal(json.data.flowId, flowId);
  assert.equal(response.headers.has('set-cookie'), false);
  assert.equal('checkoutKey' in json.data, false); assert.equal('sessionId' in json.data, false);
});
test('invoice detail/payment/QR handlers consistently authorize only the committed owner', async () => {
  const first = await start(); const { order } = await confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID');
  // Synthetic QR text is encoded locally; no upstream or payment is called.
  data.orders[0].qrisUrl = '000201synthetic-fixture';
  const { GET: detail } = await import('../src/app/api/orders/[id]/route.ts');
  const { POST: payment } = await import('../src/app/api/orders/[id]/payment/route.ts');
  const { GET: qr } = await import('../src/app/api/orders/[id]/qris/download/route.ts');
  const { paymentAdapter } = await import('../src/lib/paymentProvider.ts');
  const adapter = paymentAdapter(order); const previousStatus = adapter.status; const previousCreate = adapter.create;
  adapter.status = async () => null; adapter.create = async () => { throw new Error('UNEXPECTED_CHARGE'); };
  try {
    for (const [handler, method] of [[detail, 'GET'], [payment, 'POST'], [qr, 'GET']]) {
      const context = { params: Promise.resolve({ id: order.invoice }) };
      const request = extra => new Request(`https://store.invalid/api/orders/${order.invoice}`, { method, headers: { cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid', ...extra } });
      const valid = await handler(request({}), context); assert.equal(valid.status, 200);
      assert.equal(valid.headers.get('cache-control'), 'private, no-store');
      if (handler === detail) {
        const text = JSON.stringify(await valid.json());
        for (const denied of [order.accessToken, order.customerEmail, '+12133734253', 'whatsappE164', 'checkoutKey', 'requestHash']) assert.equal(text.includes(denied), false);
      }
      const explicitInvalid = await handler(request({ 'x-order-token': 'invalid-explicit' }), context); assert.equal(explicitInvalid.status, 404);
      const otherInvoice = await handler(request({}), { params: Promise.resolve({ id: 'INV-OTHER-CUSTOMER' }) }); assert.equal(otherInvoice.status, 404);
      data.sessions[0].revokedAt = new Date(clock);
      const revoked = await handler(request({}), context); assert.equal(revoked.status, 404);
      // Valid legacy header works independently of the revoked checkout cookie.
      const legacy = await handler(request({ 'x-order-token': order.accessToken }), context); assert.equal(legacy.status, 200);
      data.sessions[0].revokedAt = null;
    }
  } finally { adapter.status = previousStatus; adapter.create = previousCreate; }
});
test('confirm HTTP replay needs no private draft, returns no bearer and never dispatches another charge', async () => {
  const first = await start(); const { order } = await confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID');
  const { POST: confirm } = await import('../src/app/api/checkout/attempts/[flowId]/confirm/route.ts');
  const { paymentAdapter } = await import('../src/lib/paymentProvider.ts');
  const adapter = paymentAdapter(order); const previous = adapter.create; let calls = 0;
  adapter.create = async () => { calls++; throw new Error('UNEXPECTED_REPLAY_CHARGE'); };
  try {
    const request = new Request('https://store.invalid/api/checkout/attempts/confirm', { method: 'POST', headers: {
      cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid', 'content-type': 'application/json',
    }, body: JSON.stringify({ version: first.version, checkout: {} }) });
    const response = await confirm(request, { params: Promise.resolve({ flowId: first.flowId }) });
    assert.equal(response.status, 202); const json = await response.json();
    assert.deepEqual(json.data, { flowId: first.flowId, outcome: 'COMMITTED', invoice: order.invoice });
    assert.equal(calls, 0); assert.equal(data.orders.length, 1);
    assert.equal(response.headers.has('set-cookie'), false);
  } finally { adapter.create = previous; }
});
test('recovery HTTP rejects caller sessionId and uses only cookie ownership', async () => {
  const first = await start();
  const { POST: recover } = await import('../src/app/api/checkout/attempts/[flowId]/recover/route.ts');
  const request = body => new Request('https://store.invalid/api/checkout/attempts/recover', { method: 'POST', headers: {
    cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid', 'content-type': 'application/json',
  }, body: JSON.stringify(body) });
  const context = { params: Promise.resolve({ flowId: first.flowId }) };
  assert.equal((await recover(request({ sessionId: otherSessionId }), context)).status, 400);
  const response = await recover(request({}), context);
  assert.equal(response.status, 200); assert.equal((await response.json()).data.outcome, 'NOT_COMMITTED');
  assert.equal(data.orders.length, 0);
});
test('actual confirm handler creates one Order and dispatches once; refresh replays with no quote or draft', async () => {
  const first = await start(); const body = input();
  const { POST: confirm } = await import('../src/app/api/checkout/attempts/[flowId]/confirm/route.ts');
  const { paymentAdapter } = await import('../src/lib/paymentProvider.ts');
  const { geoHeaders, geoSecret, geoAudience } = await import('./geo-fixture.mjs');
  // Authenticated ingress fixture only; never a production region override.
  process.env.GEOIP_SOURCE = 'signed-ingress'; process.env.GEOIP_INGRESS_SECRET = geoSecret; process.env.GEOIP_INGRESS_AUDIENCE = geoAudience;
  const adapter = paymentAdapter({ paymentProvider: 'MIDTRANS' }); const previous = adapter.create, previousStatus = adapter.status; let calls = 0;
  adapter.status = async () => null; // Explicit provider 404 before the first idempotent dispatch.
  adapter.create = async () => { calls++; return { qr: '000201synthetic-fixture', reference: 'synthetic-reference' }; };
  const url = `https://store.invalid/api/checkout/attempts/${first.flowId}/confirm`;
  const request = checkout => new Request(url, { method: 'POST', headers: {
    cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid', 'content-type': 'application/json', ...geoHeaders(url, 'ID', 'POST'),
  }, body: JSON.stringify({ version: first.version, checkout }) });
  const context = { params: Promise.resolve({ flowId: first.flowId }) };
  try {
    const responses = await Promise.all([confirm(request(body), context), confirm(request(body), context)]);
    assert.ok(responses.some(response => response.status === 200));
    assert.equal(data.orders.length, 1); assert.equal(calls, 1);
    variant.price = 9000;
    const replay = await confirm(request({}), context); assert.equal(replay.status, 200);
    const json = await replay.json(); assert.equal(json.data.invoice, data.orders[0].invoice);
    assert.equal('accessToken' in json.data, false); assert.equal(calls, 1);
  } finally {
    adapter.create = previous; adapter.status = previousStatus;
    delete process.env.GEOIP_SOURCE; delete process.env.GEOIP_INGRESS_SECRET; delete process.env.GEOIP_INGRESS_AUDIENCE;
  }
});

test('only the authenticated invoice owner can recover a committed Login with no charge', async () => {
  const first = await start(); const { order } = await confirmLoginAttempt(sessionId, first.flowId, first.version, input(), 'ID');
  const { POST: payment } = await import('../src/app/api/orders/[id]/payment/route.ts');
  const { paymentAdapter } = await import('../src/lib/paymentProvider.ts');
  const adapter = paymentAdapter(order), previousCreate = adapter.create, previousStatus = adapter.status;
  let creates = 0, reads = 0;
  adapter.status = async () => { reads++; return null; };
  adapter.create = async () => { creates++; return { reference: 'synthetic-recovered', qr: '000201synthetic' }; };
  const request = headers => new Request(`https://store.invalid/api/orders/${order.invoice}/payment`, { method: 'POST', headers });
  const context = { params: Promise.resolve({ id: order.invoice }) };
  try {
    assert.equal((await payment(request({}), context)).status, 404);
    assert.equal((await payment(request({ cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://attacker.invalid' }), context)).status, 403);
    assert.equal(creates, 0); assert.equal(reads, 0);
    assert.equal((await payment(request({ cookie: `${session.CHECKOUT_COOKIE}=${cookie}`, origin: 'https://store.invalid' }), context)).status, 200);
    assert.equal(creates, 1); assert.equal(reads, 1); assert.equal(data.orders.length, 1);
    assert.equal(data.orders[0].paymentReference, 'synthetic-recovered');
    assert.equal(data.orders[0].qrisUrl, '000201synthetic');
  } finally { adapter.create = previousCreate; adapter.status = previousStatus; }
});

test('concurrent bootstrap has one cookie issuer; locator replay never recovers a credential', async () => {
  const { POST } = await import('../src/app/api/checkout/session/route.ts');
  const locator = crypto.randomUUID();
  const request = (value = locator, cookieHeader) => new Request('https://store.invalid/api/checkout/session', { method: 'POST', headers: {
    origin: 'https://store.invalid', 'content-type': 'application/json', ...(cookieHeader ? { cookie: cookieHeader } : {}),
  }, body: JSON.stringify({ locator: value }) });
  const responses = await Promise.all([POST(request()), POST(request())]);
  assert.equal(responses.filter(value => value.status === 201).length, 1);
  assert.equal(responses.filter(value => value.headers.has('set-cookie')).length, 1);
  const winner = responses.find(value => value.status === 201);
  const header = winner.headers.get('set-cookie');
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=lax', 'Path=/']) assert.ok(header.toLowerCase().includes(attribute.toLowerCase()));
  assert.equal(/domain=/i.test(header), false);
  const issuedCookie = header.split(';')[0];
  const json = await winner.json(); assert.deepEqual(json.data, { outcome: 'COOKIE_ISSUED' });
  const ack = await POST(request(locator, issuedCookie)); assert.equal(ack.status, 200); assert.equal(ack.headers.has('set-cookie'), false);
  assert.deepEqual((await ack.json()).data, { outcome: 'READY' });
  const retry = await POST(request()); assert.equal(retry.status, 409); assert.equal(retry.headers.has('set-cookie'), false);
  const wrongLocator = await POST(request(crypto.randomUUID(), issuedCookie)); assert.equal(wrongLocator.status, 403); assert.equal(wrongLocator.headers.has('set-cookie'), false);
  const row = data.sessions.find(value => value.id === locator);
  assert.equal(row.expiresAt - row.createdAt, session.CHECKOUT_SESSION_TTL_MS);
  assert.equal(data.attempts.length, 0); assert.equal(data.orders.length, 0);
});
test('uncertain bootstrap commit and invalid cookie fail closed with no replacement issuer', async () => {
  const { POST } = await import('../src/app/api/checkout/session/route.ts');
  const locator = crypto.randomUUID();
  const request = headers => new Request('https://store.invalid/api/checkout/session', { method: 'POST', headers: {
    origin: 'https://store.invalid', 'content-type': 'application/json', ...headers,
  }, body: JSON.stringify({ locator }) });
  loseSessionCommitResponse = true;
  const uncertain = await POST(request()); assert.equal(uncertain.status, 503); assert.equal(uncertain.headers.has('set-cookie'), false);
  const retry = await POST(request()); assert.equal(retry.status, 409); assert.equal(retry.headers.has('set-cookie'), false);
  const invalid = await POST(request({ cookie: `${session.CHECKOUT_COOKIE}=invalid` })); assert.equal(invalid.status, 401); assert.equal(invalid.headers.has('set-cookie'), false);
  const csrf = await POST(request({ origin: 'https://attacker.invalid' })); assert.equal(csrf.status, 403);
  assert.equal(data.sessions.length, 3); assert.equal(data.orders.length, 0);
});
test('package selection before confirmation advances the fence without changing the attempt key', async () => {
  const first = await start(); const key = data.attempts[0].checkoutKey;
  product.variants.push({ ...variant, id: 3, units: 200, price: 14000 });
  const changed = await attempt.openLoginAttempt(sessionId, { productId: 1, variantId: 3, flowId: first.flowId });
  assert.equal(changed.variantId, 3); assert.ok(changed.version > first.version); assert.equal(changed.selectionLocked, false);
  assert.equal(data.attempts[0].checkoutKey, key); assert.equal(data.orders.length, 0);
  await attempt.openLoginAttempt(sessionId, { productId: 1, variantId: 2, flowId: first.flowId });
  const current = await attempt.recoverLoginAttempt(sessionId, first.flowId);
  const claim = await attempt.claimLoginAttempt(sessionId, first.flowId, current.version, input());
  clock += attempt.ATTEMPT_LEASE_MS + 1; await attempt.recoverLoginAttempt(sessionId, first.flowId);
  await assert.rejects(attempt.openLoginAttempt(sessionId, { productId: 1, variantId: 3, flowId: first.flowId }), /ATTEMPT_CONFLICT/);
  assert.equal(data.attempts[0].checkoutKey, claim.checkoutKey);
});
test('knowing a victim session locator cannot mint or switch its cookie from an attacker session', async () => {
  const { POST } = await import('../src/app/api/checkout/session/route.ts');
  const request = (locator, cookieHeader) => new Request('https://store.invalid/api/checkout/session', { method: 'POST', headers: {
    origin: 'https://store.invalid', 'content-type': 'application/json', ...(cookieHeader ? { cookie: cookieHeader } : {}),
  }, body: JSON.stringify({ locator }) });
  const attacker = await POST(request(crypto.randomUUID())); assert.equal(attacker.status, 201);
  const attackerCookie = attacker.headers.get('set-cookie').split(';')[0];
  const switched = await POST(request(sessionId, attackerCookie)); assert.equal(switched.status, 403); assert.equal(switched.headers.has('set-cookie'), false);
  const publicOnly = await POST(request(sessionId)); assert.equal(publicOnly.status, 409); assert.equal(publicOnly.headers.has('set-cookie'), false);
  const legitimate = await POST(request(sessionId, `${session.CHECKOUT_COOKIE}=${cookie}`)); assert.equal(legitimate.status, 200); assert.equal(legitimate.headers.has('set-cookie'), false);
  data.sessions[0].createdAt = new Date(clock - session.CHECKOUT_SESSION_TTL_MS - 1);
  const expired = await POST(request(sessionId, `${session.CHECKOUT_COOKIE}=${cookie}`)); assert.equal(expired.status, 401); assert.equal(expired.headers.has('set-cookie'), false);
  assert.equal(data.orders.length, 0);
});
