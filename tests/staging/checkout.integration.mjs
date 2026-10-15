import test from 'node:test';
import assert from 'node:assert/strict';
import { setupIntegration } from './runtime.mjs';
import { writeApproval } from './policy.mjs';

let approved = false;
try { approved = writeApproval(process.env.STAGING_RUN_ID, process.env.STAGING_WRITE_APPROVAL); } catch { /* Listing the suite without approval must not initialize a client. */ }
let context, db, scope, api, product, variants;
const run = (name, callback) => test('staging: ' + name, { skip: !approved, timeout: 40000 }, callback);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function bounded(promise) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('STAGING_BARRIER_TIMEOUT')), 8000); })]); }
  finally { clearTimeout(timer); }
}
const codeIs = code => error => error?.code === code;

test.before(async () => {
  if (!approved) return;
  context = await setupIntegration(); ({ db, scope } = context);
  const [attempt, session, checkout, confirm, pricing, regional, encryption, bridge, bootstrap, detail] = await Promise.all([
    import('../../src/lib/checkoutAttempt.ts'), import('../../src/lib/checkoutSession.ts'), import('../../src/lib/checkout.ts'),
    import('../../src/lib/loginAttemptCheckout.ts'), import('../../src/lib/checkoutPricing.ts'), import('../../src/lib/regionalPricing.ts'),
    import('../../src/lib/crypto.ts'), import('../../src/lib/invoiceAccess.ts'), import('../../src/app/api/checkout/session/route.ts'), import('../../src/app/api/orders/[id]/route.ts'),
  ]);
  api = { ...attempt, ...session, ...checkout, ...confirm, ...pricing, ...regional, ...encryption, ...bridge, bootstrap: bootstrap.POST, invoice: detail.GET };
  product = await db.product.create({ data: { name: scope.namespace, slug: scope.namespace + '-roblox', price: 0, type: 'ROBLOX', active: true } });
  variants = {};
  for (const [name, method, price] of [['login', 'LOGIN', 7000], ['alternate', 'LOGIN', 8000], ['gamepass', 'GAMEPASS', 7000], ['username', 'GIFT_USERNAME', 7000]]) {
    variants[name] = await db.productVariant.create({ data: { productId: product.id, name: scope.namespace + '-' + name, method, units: 100, price, active: true, ...(method !== 'LOGIN' ? { maxUnits: 1000, unitStep: 100 } : {}), ...(method === 'GIFT_USERNAME' ? { capacityCheckedAt: new Date() } : {}) } });
  }
  await db.regionalPrice.createMany({ data: [{ variantId: variants.login.id, region: 'MY', amount: 1050, active: true }, { variantId: variants.login.id, region: 'PH', amount: 3000, active: true }] });
});
test.after(async () => { if (context) await context.finish(); });
test.afterEach(() => { if (scope) { scope.faults = {}; scope.fetchGate = null; } });

function request(cookie, origin = 'https://staging-tests.invalid', method = 'POST', body = {}) {
  return new Request('https://staging-tests.invalid/api/checkout/session', { method, headers: { origin, 'content-type': 'application/json', 'x-staging-test-source': scope.source, ...(cookie ? { cookie } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
}
async function session() {
  const id = scope.sessionId();
  const response = await api.bootstrap(request(null, undefined, 'POST', { locator: id }));
  assert.equal(response.status, 201);
  const header = response.headers.get('set-cookie');
  assert.ok(header && /HttpOnly/i.test(header) && /Secure/i.test(header) && /SameSite=Lax/i.test(header));
  return { id, cookie: header.split(';')[0] };
}
async function start() {
  const owner = await session();
  const row = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), productId: product.id, variantId: variants.login.id });
  return { owner, row };
}
const stored = (owner, row) => db.checkoutAttempt.findUnique({ where: { sessionId_flowId: { sessionId: owner.id, flowId: row.flowId } } });
const orderCount = () => db.order.count({ where: { productId: product.id } });
async function input(variant = variants.login) {
  const current = await db.productVariant.findUnique({ where: { id: variant.id }, include: { regionalPrices: true } });
  const quote = api.checkoutPricing('ROBLOX', 0, current, 'ID', 'QRIS');
  return { productId: product.id, variantId: variant.id, customerEmail: scope.email, paymentMethod: 'QRIS', quoteToken: api.checkoutQuoteToken(product.id, variant.id, quote), details: { username: scope.username, ...(variant.method === 'LOGIN' ? { whatsappE164: '+12025550123' } : variant.method === 'GAMEPASS' ? { gamepassUrl: 'https://www.roblox.com/game-pass/123456/Synthetic' } : {}) } };
}
const confirm = (owner, row, body, reconfirm = false) => api.confirmLoginAttempt(owner.id, row.flowId, row.version, body, 'ID', reconfirm);

run('bootstrap elects one cookie writer under concurrent inserts', async () => {
  const locator = scope.sessionId();
  const responses = await Promise.all([api.bootstrap(request(null, undefined, 'POST', { locator })), api.bootstrap(request(null, undefined, 'POST', { locator }))]);
  assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
  assert.equal(responses.filter(response => response.headers.has('set-cookie')).length, 1);
  assert.equal(await db.checkoutSession.count({ where: { id: locator } }), 1);
});

run('READY attempt joins another tab with its original checkout key', async () => {
  const { owner, row } = await start(); const before = await stored(owner, row);
  const joined = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), productId: product.id, variantId: variants.login.id });
  assert.equal(row.outcome, 'NOT_COMMITTED'); assert.equal(joined.flowId, row.flowId);
  assert.equal((await stored(owner, row)).checkoutKey, before.checkoutKey);
});

run('package change before confirmation advances the fence while preserving identity', async () => {
  const { owner, row } = await start(); const before = await stored(owner, row);
  const changed = await api.openLoginAttempt(owner.id, { flowId: row.flowId, productId: product.id, variantId: variants.alternate.id });
  assert.ok(changed.version > row.version); assert.equal(changed.variantId, variants.alternate.id);
  assert.equal((await stored(owner, row)).checkoutKey, before.checkoutKey);
});

run('owner cookie authorizes a session and foreign sessions cannot recover attempts', async () => {
  const { owner, row } = await start(); const foreign = await session();
  assert.equal((await api.checkoutSessionAccess(request(owner.cookie), true)).id, owner.id);
  await assert.rejects(api.recoverLoginAttempt(foreign.id, row.flowId), codeIs('ATTEMPT_NOT_FOUND'));
});

run('invalid expired and revoked cookies are refused', async () => {
  await assert.rejects(api.checkoutSessionAccess(request('__Host-cloudy_checkout=bad'), true), codeIs('CHECKOUT_SESSION_REQUIRED'));
  await assert.rejects(api.checkoutSessionAccess(request('__Host-cloudy_checkout=' + scope.cookie()), true), codeIs('CHECKOUT_SESSION_REQUIRED'));
  const owner = await session();
  await db.checkoutSession.update({ where: { id: owner.id }, data: { expiresAt: new Date(0) } });
  await assert.rejects(api.checkoutSessionAccess(request(owner.cookie), true), codeIs('CHECKOUT_SESSION_REQUIRED'));
  const revoked = await session();
  await db.checkoutSession.update({ where: { id: revoked.id }, data: { revokedAt: new Date() } });
  await assert.rejects(api.checkoutSessionAccess(request(revoked.cookie), true), codeIs('CHECKOUT_SESSION_REQUIRED'));
});

run('mutation rejects missing authorization and cross origin before side effects', async () => {
  const owner = await session(); const locator = scope.sessionId();
  await assert.rejects(api.checkoutSessionAccess(request(null), true), codeIs('CHECKOUT_SESSION_REQUIRED'));
  await assert.rejects(api.checkoutSessionAccess(request(owner.cookie, 'https://attacker.invalid'), true), codeIs('CSRF_REJECTED'));
  const denied = await api.bootstrap(request(null, 'https://attacker.invalid', 'POST', { locator }));
  assert.equal(denied.status, 403); assert.equal(denied.headers.has('set-cookie'), false);
  assert.equal(await db.checkoutSession.count({ where: { id: locator } }), 0);
});

run('atomic commit stores encrypted contact and safe attempt DTO', async () => {
  const { owner, row } = await start(); const result = await confirm(owner, row, await input());
  const attempt = await stored(owner, row); const detail = await db.robloxOrderDetail.findUnique({ where: { orderId: result.order.id } });
  assert.equal(attempt.state, 'COMMITTED'); assert.equal(attempt.orderId, result.order.id);
  assert.equal(result.order.checkoutKey, attempt.checkoutKey);
  assert.notEqual(detail.whatsappE164, '+12025550123'); assert.equal(api.decryptData(detail.whatsappE164), '+12025550123');
  const dto = await api.recoverLoginAttempt(owner.id, row.flowId);
  assert.deepEqual(Object.keys(dto).sort(), ['flowId', 'productId', 'variantId', 'version', 'selectionLocked', 'outcome', 'expiresAt', 'invoice'].sort());
});

run('concurrent double submit creates exactly one order', async () => {
  const { owner, row } = await start(); const body = await input(); const before = await orderCount();
  const results = await Promise.allSettled([confirm(owner, row, body), confirm(owner, row, body)]);
  assert.ok(results.some(result => result.status === 'fulfilled'));
  assert.equal(await orderCount(), before + 1);
  for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.code, 'CHECKOUT_UNKNOWN');
  const resolved = await api.recoverLoginAttempt(owner.id, row.flowId);
  assert.equal(resolved.outcome, 'COMMITTED');
  const replay = await confirm(owner, resolved, body); assert.equal(replay.created, false); assert.equal(replay.order.invoice, resolved.invoice);
});

run('committed purchase repeats only after an explicit previous flow acknowledgement', async () => {
  const { owner, row } = await start(); const body = await input(); const before = await orderCount();
  const first = await confirm(owner, row, body);
  const joined = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), productId: product.id, variantId: variants.login.id });
  assert.equal(joined.flowId, row.flowId);
  const next = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), previousFlowId: row.flowId, productId: product.id, variantId: variants.login.id });
  const second = await confirm(owner, next, body);
  assert.notEqual(first.order.id, second.order.id); assert.equal(await orderCount(), before + 2);
});

run('MySQL unique constraints reject a duplicated session hash and checkout key', async () => {
  const { owner, row } = await start(); const original = await db.checkoutSession.findUnique({ where: { id: owner.id } });
  await assert.rejects(db.checkoutSession.create({ data: { id: scope.sessionId(), tokenHash: original.tokenHash, expiresAt: original.expiresAt } }), codeIs('P2002'));
  const attempt = await stored(owner, row);
  await assert.rejects(db.checkoutAttempt.create({ data: { sessionId: owner.id, flowId: scope.flowId(), productId: product.id, variantId: variants.login.id, checkoutKey: attempt.checkoutKey, expiresAt: attempt.expiresAt } }), codeIs('P2002'));
});

run('failure before COMMITTED rolls back order and detail together', async () => {
  const { owner, row } = await start(); const before = await orderCount();
  const detailsBefore = await db.robloxOrderDetail.count({ where: { orderId: { in: [...scope.orders] } } });
  scope.faults.failCommittedOnce = true;
  await assert.rejects(confirm(owner, row, await input()), codeIs('CHECKOUT_UNKNOWN'));
  assert.equal(await orderCount(), before);
  assert.equal(await db.robloxOrderDetail.count({ where: { orderId: { in: [...scope.orders] } } }), detailsBefore);
  assert.equal((await api.recoverLoginAttempt(owner.id, row.flowId)).outcome, 'UNKNOWN');
});

run('lost acknowledgement after a real commit recovers the same invoice', async () => {
  const { owner, row } = await start(); const body = await input(); const before = await orderCount();
  scope.faults.loseCommitAckOnce = true;
  await assert.rejects(confirm(owner, row, body), codeIs('CHECKOUT_UNKNOWN'));
  const refresh = await api.recoverLoginAttempt(owner.id, row.flowId);
  assert.equal(refresh.outcome, 'COMMITTED');
  const replay = await confirm(owner, refresh, body);
  assert.equal(replay.order.invoice, refresh.invoice); assert.equal(replay.created, false); assert.equal(await orderCount(), before + 1);
});

run('UNKNOWN plus late commit never opens a second intent', async () => {
  const { owner, row } = await start(); const body = await input(); const entered = deferred(), release = deferred(); const before = await orderCount();
  scope.fetchGate = async () => { entered.resolve(); await release.promise; };
  const pending = confirm(owner, row, body); pending.catch(() => {});
  try {
    await bounded(entered.promise);
    assert.equal((await api.recoverLoginAttempt(owner.id, row.flowId)).outcome, 'UNKNOWN');
    const joined = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), productId: product.id, variantId: variants.login.id });
    assert.equal(joined.flowId, row.flowId);
  } finally { scope.fetchGate = null; release.resolve(); }
  const result = await pending;
  assert.equal((await api.recoverLoginAttempt(owner.id, row.flowId)).invoice, result.order.invoice); assert.equal(await orderCount(), before + 1);
});

run('expired lease verifies absence and fences a stale version before retry', async () => {
  const { owner, row } = await start(); const body = await input(); const claimed = await api.claimLoginAttempt(owner.id, row.flowId, row.version, body);
  await db.checkoutAttempt.update({ where: { id: claimed.attempt.id }, data: { leaseUntil: new Date(0) } });
  const recovered = await api.recoverLoginAttempt(owner.id, row.flowId);
  assert.equal(recovered.outcome, 'NOT_COMMITTED'); assert.ok(recovered.version > claimed.version);
  await assert.rejects(confirm(owner, { ...row, version: claimed.version }, body), codeIs('ATTEMPT_FENCED'));
  const result = await confirm(owner, recovered, body); assert.equal(result.order.checkoutKey, claimed.checkoutKey);
});

run('CANCELLED and EXPIRED cannot be revived while explicit repeat is allowed', async () => {
  for (const state of ['CANCELLED', 'EXPIRED']) {
    const { owner, row } = await start(); const attempt = await stored(owner, row);
    await db.checkoutAttempt.update({ where: { id: attempt.id }, data: { state } });
    await assert.rejects(confirm(owner, row, await input()), codeIs('ATTEMPT_' + state));
    const stale = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), productId: product.id, variantId: variants.login.id });
    assert.equal(stale.flowId, row.flowId);
    const repeated = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), previousFlowId: row.flowId, productId: product.id, variantId: variants.login.id });
    assert.notEqual(repeated.flowId, row.flowId);
  }
});

run('attempt expiry and absolute session expiry reject outstanding work', async () => {
  const { owner, row } = await start(); const attempt = await stored(owner, row);
  await db.checkoutAttempt.update({ where: { id: attempt.id }, data: { expiresAt: new Date(0) } });
  const expired = await api.recoverLoginAttempt(owner.id, row.flowId); assert.equal(expired.outcome, 'EXPIRED');
  await assert.rejects(confirm(owner, expired, await input()), codeIs('ATTEMPT_EXPIRED'));
  await db.checkoutSession.update({ where: { id: owner.id }, data: { createdAt: new Date(Date.now() - api.CHECKOUT_SESSION_TTL_MS - 1000) } });
  await assert.rejects(api.recoverLoginAttempt(owner.id, row.flowId), codeIs('CHECKOUT_SESSION_REQUIRED'));
});

run('changed server price requires a fresh quote and explicit reconfirmation', async () => {
  const { owner, row } = await start(); const body = await input();
  try {
    await db.productVariant.update({ where: { id: variants.login.id }, data: { price: 7100 } });
    await assert.rejects(confirm(owner, row, body), codeIs('PRICE_CHANGED'));
    let current = await api.recoverLoginAttempt(owner.id, row.flowId);
    await assert.rejects(confirm(owner, current, await input()), codeIs('RECONFIRM_REQUIRED'));
    current = await api.recoverLoginAttempt(owner.id, row.flowId);
    assert.equal((await confirm(owner, current, await input(), true)).order.totalAmount, 7100);
  } finally { await db.productVariant.update({ where: { id: variants.login.id }, data: { price: 7000 } }); }
});

run('ID MY PH amounts come from persisted regional configuration and unavailable prices fail closed', async () => {
  const variant = await db.productVariant.findUnique({ where: { id: variants.login.id }, include: { regionalPrices: true } });
  assert.deepEqual(['ID', 'MY', 'PH'].map(region => api.regionalAmount(variant, region)), [7000, 1050, 3000]);
  for (const region of ['MY', 'PH']) {
    const { owner, row } = await start(); const before = await orderCount();
    await assert.rejects(api.confirmLoginAttempt(owner.id, row.flowId, row.version, await input(), region), codeIs('PAYMENT_REGION_UNAVAILABLE'));
    assert.equal(await orderCount(), before);
  }
  const { owner, row } = await start(); const body = await input();
  const missing = await db.productVariant.findUnique({ where: { id: variants.alternate.id }, include: { regionalPrices: true } });
  assert.equal(api.regionalAmount(missing, 'MY'), null);
  const missingOwner = await session();
  const missingAttempt = await api.openLoginAttempt(missingOwner.id, { flowId: scope.flowId(), productId: product.id, variantId: variants.alternate.id });
  await assert.rejects(api.confirmLoginAttempt(missingOwner.id, missingAttempt.flowId, missingAttempt.version, await input(variants.alternate), 'MY'), codeIs('REGIONAL_PRICE_UNAVAILABLE'));
  await db.regionalPrice.create({ data: { variantId: variants.login.id, region: 'ID', amount: 7000, active: false } });
  try { await assert.rejects(confirm(owner, row, body), codeIs('REGIONAL_PRICE_UNAVAILABLE')); }
  finally { await db.regionalPrice.update({ where: { variantId_region: { variantId: variants.login.id, region: 'ID' } }, data: { active: true } }); }
});

run('GAMEPASS and GIFT_USERNAME retain distinct details and server totals', async () => {
  for (const variant of [variants.gamepass, variants.username]) {
    const result = await api.createCheckout(await input(variant), scope.key(), 'ID');
    const detail = await db.robloxOrderDetail.findUnique({ where: { orderId: result.order.id } });
    assert.equal(detail.method, variant.method); assert.equal(detail.whatsappE164, null); assert.equal(result.order.totalAmount, 7000);
    assert.equal(detail.gamepassPrice, variant.method === 'GAMEPASS' ? 143 : null);
  }
});

run('legacy invoice replay and explicit legacy token remain compatible on synthetic history', async () => {
  const body = await input(); const key = scope.key(); const original = await api.createCheckout(body, key, 'ID');
  const replay = await api.createLegacyCheckout(body, key, null); assert.equal(replay.order.id, original.order.id); assert.equal(replay.created, false);
  const req = new Request('https://staging-tests.invalid/api/orders/' + original.order.invoice, { headers: { 'x-order-token': original.order.accessToken } });
  const where = await api.invoiceAccessWhere(req, original.order.invoice);
  assert.equal((await db.order.findFirst({ where })).id, original.order.id);
});

run('invoice owner DTO never exposes contact ciphertext or access credentials', async () => {
  const { owner, row } = await start(); const result = await confirm(owner, row, await input()); const foreign = await session();
  const params = { params: Promise.resolve({ id: result.order.invoice }) };
  const response = await api.invoice(request(owner.cookie, undefined, 'GET'), params); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const json = JSON.stringify(await response.json());
  for (const forbidden of ['whatsappE164', 'tokenHash', 'accessToken', 'requestHash', '+12025550123']) assert.equal(json.includes(forbidden), false);
  const denied = await api.invoice(request(foreign.cookie, undefined, 'GET'), params); assert.equal(denied.status, 404);
  const deniedJson = JSON.stringify(await denied.json()); assert.equal(deniedJson.includes(scope.email), false); assert.equal(deniedJson.includes(scope.username), false);
});

run('real MySQL deadlock rejects one contender without an order or false success', async () => {
  const other = await db.product.create({ data: { name: scope.namespace + '-lock', slug: scope.namespace + '-lock', price: 0, type: 'ROBLOX', active: false } });
  const ready = deferred(); let arrived = 0; const before = await orderCount();
  const contender = (first, second) => db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${first} FOR UPDATE`;
    if (++arrived === 2) ready.resolve(); await bounded(ready.promise);
    await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${second} FOR UPDATE`;
  }, { timeout: 15000 });
  const results = await Promise.allSettled([contender(product.id, other.id), contender(other.id, product.id)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const failure = results.find(result => result.status === 'rejected').reason;
  assert.ok(failure.code === 'P2034' || failure.code === 'P2010' && String(failure.meta?.code) === '1213');
  assert.equal(await orderCount(), before);
});

run('session lock contention times out without claiming a successful order', async () => {
  const { owner, row } = await start(); const body = await input(); const ready = deferred(), release = deferred(); const before = await orderCount();
  const holder = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM \`CheckoutSession\` WHERE id = ${owner.id} FOR UPDATE`;
    ready.resolve(); await release.promise;
  }, { timeout: 25000 }); holder.catch(() => {});
  let deadline;
  // MySQL can wait longer than Prisma's deadline. Let the real lock query return
  // after that deadline, so the expired transaction can fail and release resources.
  const safety = setTimeout(release.resolve, 20000);
  try {
    await bounded(ready.promise);
    scope.faults.onSessionLock = () => {
      delete scope.faults.onSessionLock;
      deadline = setTimeout(release.resolve, api.attemptTransaction.timeout + 1000);
    };
    await assert.rejects(confirm(owner, row, body), codeIs('CHECKOUT_UNKNOWN'));
  } finally { clearTimeout(deadline); clearTimeout(safety); release.resolve(); await holder; }
  assert.equal(await orderCount(), before);
  assert.equal((await api.recoverLoginAttempt(owner.id, row.flowId)).outcome, 'NOT_COMMITTED');
});

test('staging: independently expired quote token', { skip: 'Current quote token has no expiry field; price drift and attempt expiry are covered separately' }, () => {});
