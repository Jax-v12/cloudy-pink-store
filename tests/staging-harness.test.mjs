import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { stagingTarget, writeApproval, fixtureScope, guardedClient, isolatedEnvironment, workerArguments } from './staging/policy.mjs';
import { loadTarget, realClient } from './staging/runtime.mjs';
import reporter from './staging/reporter.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import * as sandboxPolicy from './staging/sandbox-policy.mjs';
import sandboxReporter from './staging/sandbox-reporter.mjs';
import { loginCredentialsFixture } from './login-access-fixture.mjs';
import { parseDetails } from '../src/lib/commerce.ts';

const runId = '662db2ed-e635-4d54-98a1-e1aa3348df7e';
const target = 'mysql://synthetic:synthetic@mysql-26d9d666-fixture.aivencloud.com:3306/cloudy_staging?ssl-mode=REQUIRED';
const scope = () => fixtureScope(runId, true);

test('actual staging loader and reporter launch portably without a database', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudy-staging-loader-'));
  const file = path.join(folder, 'smoke.mjs');
  fs.writeFileSync(file, "import test from 'node:test'; test('staging: loader smoke', () => {});\n");
  try {
    const args = workerArguments(['loader smoke']); args[args.length - 1] = file;
    const env = { ...isolatedEnvironment(process.env), DATABASE_URL: target.replace('ssl-mode=REQUIRED', 'sslaccept=strict'), STAGING_RUN_ID: runId, STAGING_WRITE_APPROVAL: 'cloudy_staging:' + runId };
    const result = spawnSync(process.execPath, args, { env, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0); assert.match(result.stdout, /"result":"PASS"/);
  } finally { fs.unlinkSync(file); fs.rmdirSync(folder); }
});

test('staging target accepts only the expected service and exact staging database', () => {
  assert.equal(stagingTarget(target).pathname, '/cloudy_staging');
  for (const url of [target.replace('cloudy_staging', 'defaultdb'), target.replace('mysql-26d9d666-', 'other-'), target.replace('.aivencloud.com', '.aivencloud.com.evil.invalid'), target.replace('mysql:', 'postgres:'), target + '&database=defaultdb', target.replace('/cloudy_staging?', '/%63loudy_staging?'), target + '&sslaccept=strict&sslaccept=accept_invalid_certs']) {
    assert.throws(() => stagingTarget(url), /STAGING_TARGET_REJECTED/);
  }
});

test('only strict TLS reaches the Prisma constructor and normalization stays in memory', async () => {
  assert.throws(() => realClient(target), /STAGING_STRICT_TLS_REQUIRED/);
  const previous = process.env.CLOUDY_STAGING_URL;
  const previousCertificate = process.env.STAGING_CA_CERT;
  try {
    process.env.CLOUDY_STAGING_URL = target; delete process.env.STAGING_CA_CERT;
    const parsed = new URL(await loadTarget());
    assert.equal(parsed.searchParams.get('sslaccept'), 'strict'); assert.equal(parsed.searchParams.has('ssl-mode'), false);
    assert.equal(process.env.CLOUDY_STAGING_URL, target);
  } finally {
    if (previous === undefined) delete process.env.CLOUDY_STAGING_URL; else process.env.CLOUDY_STAGING_URL = previous;
    if (previousCertificate === undefined) delete process.env.STAGING_CA_CERT; else process.env.STAGING_CA_CERT = previousCertificate;
  }
});

test('write permission is absent by default and is bound to this staging run', () => {
  for (const approval of [undefined, '', 'true', 'cloudy_staging:' + crypto.randomUUID(), 'defaultdb:' + runId]) assert.throws(() => writeApproval(runId, approval), /STAGING_WRITE_APPROVAL_REQUIRED/);
  assert.equal(writeApproval(runId, 'cloudy_staging:' + runId), true);
  assert.throws(() => writeApproval('../invalid', 'cloudy_staging:../invalid'), /STAGING_RUN_ID_INVALID/);
});

test('worker environment contains only operating system inputs before synthetic configuration', () => {
  assert.deepEqual(isolatedEnvironment({ PATH: 'synthetic-path', MIDTRANS_SERVER_KEY: 'synthetic-private-value', DATABASE_URL: 'synthetic-private-value', NODE_OPTIONS: '--unsafe-option' }), { PATH: 'synthetic-path' });
});

test('read-only guard refuses writes before calling Prisma', async () => {
  let calls = 0;
  const fixture = fixtureScope(runId, false);
  const db = guardedClient({ product: { create: async () => { calls++; } } }, fixture);
  await assert.rejects(db.product.create({ data: { slug: fixture.namespace + '-login', name: fixture.namespace } }), /STAGING_WRITES_DISABLED/);
  assert.equal(calls, 0);
});

test('fixture selectors reject global, foreign, empty, NOT and unsafe OR scopes', async () => {
  let calls = 0;
  const fixture = scope(); fixture.products.add(42);
  const db = guardedClient({ product: { updateMany: async () => { calls++; } } }, fixture);
  for (const where of [{}, { id: 9 }, { id: { in: [] } }, { NOT: { id: 42 } }, { OR: [{ id: 42 }, { id: 9 }] }]) {
    await assert.rejects(db.product.updateMany({ where, data: { active: false } }), /STAGING_FIXTURE_SCOPE_REJECTED/);
  }
  assert.equal(calls, 0);
});

test('fixture delegate forwards a bounded update to the real client', async () => {
  const fixture = scope(); fixture.products.add(42);
  const calls = [];
  const db = guardedClient({ product: { update: async args => { calls.push(args); return { id: 42 }; } } }, fixture);
  await db.product.update({ where: { id: 42 }, data: { active: false } });
  assert.equal(calls.length, 1);
  await assert.rejects(db.product.update({ where: { id: 42 }, data: { orders: { deleteMany: {} } } }), /STAGING_DATA_REJECTED/);
});

test('foreign relation rewrites and synthetic orders outside the run are rejected', async () => {
  const fixture = scope(); fixture.products.add(42); fixture.variants.add(7); fixture.orders.add(8);
  const db = guardedClient({ order: { create: async () => {}, update: async () => {} } }, fixture);
  await assert.rejects(db.order.create({ data: { productId: 42, customerEmail: 'real@example.invalid', checkoutKey: crypto.randomUUID() } }), /STAGING_DATA_REJECTED/);
  await assert.rejects(db.order.update({ where: { id: 8 }, data: { productId: 9 } }), /STAGING_DATA_REJECTED/);
  await assert.rejects(db.order.deleteMany({ where: { id: 8 } }), /STAGING_OPERATION_REJECTED/);
});

test('package updates permit an owned variant and refuse a foreign variant', async () => {
  const fixture = scope(); const id = crypto.randomUUID(); fixture.attempts.add(id); fixture.variants.add(7); let writes = 0;
  const db = guardedClient({ checkoutAttempt: { update: async () => { writes++; return { id, variantId: 7, version: 1 }; } } }, fixture);
  assert.equal((await db.checkoutAttempt.update({ where: { id }, data: { variantId: 7, version: 1 } })).variantId, 7);
  await assert.rejects(db.checkoutAttempt.update({ where: { id }, data: { variantId: 9, version: 2 } }), /STAGING_DATA_REJECTED/);
  assert.equal(writes, 1);
});

test('cleanup counters require an exact owned rate-limit id', async () => {
  const fixture = scope(); fixture.rateLimits.add('fixture-counter');
  const db = guardedClient({ rateLimit: { deleteMany: async () => ({ count: 1 }) } }, fixture);
  await assert.rejects(db.rateLimit.deleteMany({}), /STAGING_FIXTURE_SCOPE_REJECTED/);
  await assert.rejects(db.rateLimit.deleteMany({ where: { id: { startsWith: 'attempt-' } } }), /STAGING_FIXTURE_SCOPE_REJECTED/);
  assert.equal((await db.rateLimit.deleteMany({ where: { id: 'fixture-counter' } })).count, 1);
});

test('reserved session ids do not grant mutation ownership and bulk creates cannot escape tracking', async () => {
  const fixture = scope(); const id = fixture.sessionId(); let writes = 0;
  const db = guardedClient({ checkoutSession: { deleteMany: async () => { writes++; }, update: async () => { writes++; } }, product: { createMany: async () => { writes++; } } }, fixture);
  await assert.rejects(db.checkoutSession.deleteMany({ where: { id } }), /STAGING_FIXTURE_SCOPE_REJECTED/);
  await assert.rejects(db.checkoutSession.update({ where: { id }, data: { revokedAt: new Date() } }), /STAGING_FIXTURE_SCOPE_REJECTED/);
  await assert.rejects(db.product.createMany({ data: [] }), /STAGING_OPERATION_REJECTED/);
  assert.equal(writes, 0);
});

test('fixture creation budget is enforced before a database call', async () => {
  const fixture = scope(); fixture.products.add(1); fixture.products.add(2); let writes = 0;
  const db = guardedClient({ product: { create: async () => { writes++; } } }, fixture);
  await assert.rejects(db.product.create({ data: { name: fixture.namespace, slug: fixture.namespace + '-extra', price: 0, type: 'ROBLOX' } }), /STAGING_FIXTURE_BUDGET_EXCEEDED/);
  assert.equal(writes, 0);
});

test('transaction wrapping preserves callback isolation and options', async () => {
  const fixture = scope(); fixture.products.add(42); let optionsSeen;
  const raw = { product: { update: async () => ({ id: 42 }) }, $transaction: async (callback, options) => { optionsSeen = options; return callback(raw); } };
  const db = guardedClient(raw, fixture);
  const result = await db.$transaction(async tx => {
    await assert.rejects(tx.product.update({ where: { id: 9 }, data: { active: false } }), /STAGING_FIXTURE_SCOPE_REJECTED/);
    return tx.product.update({ where: { id: 42 }, data: { active: false } });
  }, { timeout: 1000 });
  assert.equal(result.id, 42); assert.equal(optionsSeen.timeout, 1000);
  await assert.rejects(db.$transaction([]), /STAGING_OPERATION_REJECTED/);
});

test('raw SQL permits only parameterized production locks for owned identities', async () => {
  const fixture = scope(); fixture.products.add(42);
  const db = guardedClient({ $queryRaw: async () => [] }, fixture);
  await db.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${42} FOR UPDATE`;
  await assert.rejects(db.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${9} FOR UPDATE`, /STAGING_RAW_QUERY_REJECTED/);
  await assert.rejects(db.$queryRawUnsafe('SELECT * FROM `Order`'), /STAGING_OPERATION_REJECTED/);
  await assert.rejects(db.$executeRaw`DELETE FROM \`Order\``, /STAGING_OPERATION_REJECTED/);
});

test('lock deadline instrumentation observes only an owned session lock before forwarding', async () => {
  const fixture = scope(); const id = fixture.sessionId(); fixture.createdSessions.add(id); let observed = 0;
  fixture.faults.onSessionLock = () => { observed++; };
  const db = guardedClient({ $queryRaw: async () => { assert.equal(observed, 1); return []; } }, fixture);
  await db.$queryRaw`SELECT id FROM \`CheckoutSession\` WHERE id = ${id} FOR UPDATE`;
  await assert.rejects(db.$queryRaw`SELECT id FROM \`CheckoutSession\` WHERE id = ${crypto.randomUUID()} FOR UPDATE`, /STAGING_RAW_QUERY_REJECTED/);
  assert.equal(observed, 1);
  assert.throws(() => workerArguments(['.*']), /STAGING_CASE_REJECTED/);
});

test('actual clientKey normalization yields a run-specific counter without adopting existing counters', async () => {
  const fixture = scope(); let writes = 0;
  const raw = { rateLimit: { findUnique: async () => null, upsert: async () => { writes++; return { points: 1 }; } } };
  const originalPrisma = globalThis.prisma, originalHeader = process.env.TRUSTED_CLIENT_IP_HEADER, originalVercel = process.env.VERCEL;
  globalThis.prisma = guardedClient(raw, fixture);
  process.env.TRUSTED_CLIENT_IP_HEADER = 'x-staging-test-source'; delete process.env.VERCEL;
  try {
    const { clientKey, consumeRateLimit } = await import('../src/lib/rateLimit.ts');
    const key = clientKey(new Request('https://staging-tests.invalid', { headers: { 'x-staging-test-source': fixture.source } }));
    assert.equal(key, fixture.rateSource);
    assert.equal(await consumeRateLimit('checkout-bootstrap-source', key, 60, 60000), true);
    assert.equal(writes, 1); assert.equal(fixture.rateLimits.size, 1);
    const otherScope = scope();
    const guarded = guardedClient({ rateLimit: { findUnique: async () => ({ id: [...fixture.rateLimits][0] }), upsert: async () => { writes++; } } }, otherScope);
    const id = [...fixture.rateLimits][0];
    await assert.rejects(guarded.rateLimit.upsert({ where: { id }, create: { id, points: 1, expiresAt: new Date() }, update: { points: { increment: 1 } } }), /STAGING_COUNTER_COLLISION/);
    assert.equal(writes, 1); assert.equal(otherScope.rateLimits.size, 0);
  } finally {
    if (originalPrisma === undefined) delete globalThis.prisma; else globalThis.prisma = originalPrisma;
    if (originalHeader === undefined) delete process.env.TRUSTED_CLIENT_IP_HEADER; else process.env.TRUSTED_CLIENT_IP_HEADER = originalHeader;
    if (originalVercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = originalVercel;
  }
});

test('safe reporter suppresses assertion payloads stdout stderr and credentials', async () => {
  async function* events() {
    yield { type: 'test:fail', data: { name: 'staging: safe case', details: { error: new Error('synthetic-secret-value') } } };
    yield { type: 'test:stdout', data: { message: 'synthetic-secret-value' } };
    yield { type: 'test:stderr', data: { message: 'synthetic-secret-value' } };
  }
  let result = '';
  for await (const output of reporter(events())) result += output;
  assert.match(result, /FAIL/); assert.doesNotMatch(result, /synthetic-secret-value/);
});

test('direct staging worker execution stops before loading config or connecting', () => {
  const result = spawnSync(process.execPath, ['tests/staging/run.mjs', 'run', '--run-id=' + runId], { encoding: 'utf8', env: { SystemRoot: process.env.SystemRoot, PATH: process.env.PATH } });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /STAGING_WRITE_APPROVAL_REQUIRED/);
  assert.doesNotMatch(result.stdout + result.stderr, /mysql:\/\/|password|DATABASE_URL=/i);
});

for (const [label, policy] of [['staging', { fixtureScope, guardedClient }], ['sandbox', sandboxPolicy]]) {
  test(`${label} Login checkout accepts the current encrypted secret envelope and refuses unsafe nested data`, async () => {
    const fixture = policy.fixtureScope(runId, true);
    fixture.products.add(42);
    const ciphertext = 'a'.repeat(32) + ':' + 'b'.repeat(32) + ':' + 'c'.repeat(64);
    const data = {
      invoice: 'INV-' + crypto.randomUUID(), productId: 42, type: 'ROBLOX',
      checkoutKey: fixture.key(), customerEmail: fixture.email, accountStockId: null,
      totalAmount: 1000, currency: 'IDR', pricingRegion: 'ID', paymentProvider: 'MIDTRANS', paymentMethod: 'QRIS',
      robloxDetail: { create: { method: 'LOGIN', username: fixture.username, whatsappE164: ciphertext } },
      secret: { create: { ciphertext, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) } },
    };
    let writes = 0;
    const db = policy.guardedClient({ order: { create: async () => { writes++; return { id: 8, invoice: data.invoice }; } } }, fixture);
    await db.order.create({ data });
    assert.equal(writes, 1);
    assert.equal(fixture.orders.has(8), true);
    for (const secret of [
      undefined,
      { create: { ...data.secret.create, ciphertext: 'plaintext-fixture' } },
      { create: { ...data.secret.create, expiresAt: new Date(NaN) } },
      { create: { ...data.secret.create, expiresAt: new Date(Date.now() + 73 * 60 * 60 * 1000) } },
      { create: { ...data.secret.create, orderId: 99 } },
      { connect: { orderId: 99 } },
    ]) await assert.rejects(db.order.create({ data: { ...data, secret } }), /DATA_REJECTED/);
    for (const method of ['GAMEPASS', 'GIFT_USERNAME']) {
      await assert.rejects(db.order.create({ data: { ...data, robloxDetail: { create: { method, username: fixture.username } } } }), /DATA_REJECTED/);
    }
    assert.equal(writes, 1);
  });

  test(`${label} secret cleanup is restricted to owned orders and current encrypted fields`, async () => {
    const fixture = policy.fixtureScope(runId, true); fixture.orders.add(8);
    let writes = 0;
    const db = policy.guardedClient({ orderSecret: { create: async () => { writes++; return { orderId: 8 }; }, deleteMany: async () => { writes++; return { count: 1 }; } }, robloxOrderDetail: { updateMany: async () => { writes++; return { count: 1 }; } } }, fixture);
    const data = { orderId: 8, ciphertext: 'a'.repeat(32) + ':' + 'b'.repeat(32) + ':' + 'c'.repeat(64), expiresAt: new Date(Date.now() + 1000) };
    await db.orderSecret.create({ data });
    assert.equal((await db.orderSecret.deleteMany({ where: { orderId: 8 } })).count, 1);
    await db.robloxOrderDetail.updateMany({ where: { orderId: 8, method: 'LOGIN' }, data: { whatsappE164: null } });
    await assert.rejects(db.orderSecret.deleteMany({ where: { orderId: 9 } }), /FIXTURE_SCOPE_REJECTED/);
    await assert.rejects(db.orderSecret.create({ data: { ...data, orderId: 9 } }), /DATA_REJECTED/);
    await assert.rejects(db.orderSecret.create({ data: { orderId: 8, secretType: 'LOGIN', encryptedData: 'plaintext' } }), /DATA_REJECTED|OPERATION_REJECTED/);
    await assert.rejects(db.robloxOrderDetail.updateMany({ where: { orderId: 9 }, data: { whatsappE164: null } }), /FIXTURE_SCOPE_REJECTED/);
    await assert.rejects(db.robloxOrderDetail.updateMany({ where: { orderId: 8 }, data: { whatsappE164: 'plaintext' } }), /DATA_REJECTED/);
    assert.equal(writes, 3);
  });
}

test('actual staging and Sandbox fixture builders satisfy the current Login account contract', async () => {
  for (const filename of ['checkout.integration.mjs', 'sandbox.integration.mjs']) {
    const source = fs.readFileSync(new URL('./staging/' + filename, import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
    const fakeTest = () => {};
    fakeTest.before = fakeTest.after = fakeTest.afterEach = () => {};
    const sandbox = { test: fakeTest, process: { env: {} }, writeApproval: () => true, loginCredentialsFixture };
    vm.runInNewContext(source + `
      scope = { username: 'FixtureUser', email: 'fixture@example.invalid' }; product = { id: 42 };
      ${filename.startsWith('checkout') ? "variants = { login: { id: 7, method: 'LOGIN' } };" : 'variant = { id: 7 };'}
      db = { productVariant: { findUnique: async () => ({}) } };
      api = { checkoutPricing: () => ({}), checkoutQuoteToken: () => 'synthetic-quote' };
      globalThis.buildInput = input;
    `, sandbox);
    const body = await sandbox.buildInput();
    assert.deepEqual(parseDetails('ROBLOX', { method: 'LOGIN' }, body.details).loginCredentials, loginCredentialsFixture());
  }
});

test('Sandbox payment transition forwards paidAt only on owned paid orders', async () => {
  const fixture = sandboxPolicy.fixtureScope(runId, true); fixture.orders.add(8);
  let writes = 0;
  const db = sandboxPolicy.guardedClient({ order: { updateMany: async () => { writes++; return { count: 1 }; } } }, fixture);
  const paidAt = new Date();
  await db.order.updateMany({ where: { id: 8, status: 'PENDING' }, data: { status: 'PAID', paidAt, fulfillmentStatus: 'QUEUED' } });
  await assert.rejects(db.order.updateMany({ where: { id: 9 }, data: { status: 'PAID', paidAt } }), /FIXTURE_SCOPE_REJECTED/);
  await assert.rejects(db.order.updateMany({ where: { id: 8 }, data: { status: 'PAID', paidAt: 'invalid' } }), /DATA_REJECTED/);
  assert.equal(writes, 1);
});

async function sandboxCases({ qrisUrl = 'https://api.sandbox.midtrans.com/v2/qris/fixture/qr-code', fetchResult, providerState = 'pending' } = {}) {
  const cases = new Map(), skipped = [];
  const order = { id: 8, invoice: 'INV-' + crypto.randomUUID(), qrisUrl, paymentReference: 'fixture-reference', status: 'PENDING' };
  const state = { applies: 0, reads: 0, fetches: 0, statuses: 0 };
  const providerStatus = { state: providerState };
  const fakeTest = (name, _options, callback) => cases.set(name, callback);
  fakeTest.before = fakeTest.after = fakeTest.afterEach = () => {};
  const source = fs.readFileSync(new URL('./staging/sandbox.integration.mjs', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
  const sandbox = {
    test: fakeTest, assert, crypto, process: { env: {} }, writeApproval: () => true,
    setTimeout: callback => { callback(); }, AbortSignal, Request, Response,
    scopeFixture: sandboxPolicy.fixtureScope(runId, true),
    fetch: async () => { state.fetches++; if (fetchResult instanceof Error) throw fetchResult; return fetchResult ?? { ok: true }; },
    order,
    apiFixture: {
      paymentAdapter: () => ({ status: async () => { state.statuses++; return providerStatus; } }),
      applyPaymentStatus: async (_id, status) => { assert.equal(status, providerStatus); state.applies++; order.status = 'PAID'; },
      webhook: async () => new Response(null, { status: [403, 400, 400, 403][state.webhooks++] }),
      invoice: async req => req.headers.get('cookie') === 'fixture-owner'
        ? Response.json({ success: true, data: { totalAmount: 1000 } }, { headers: { 'cache-control': 'private, no-store' } })
        : Response.json({ success: false }, { status: 404 }),
      bootstrap: async () => Response.json({}, { status: 201, headers: { 'set-cookie': '__Host-cloudy_checkout=fixture-foreign; HttpOnly; Secure; SameSite=Lax' } }),
    },
    dbFixture: {
      order: { findUnique: async () => order },
      fulfillmentJob: { findFirst: async () => { state.reads++; return {}; } },
    },
  };
  state.webhooks = 0;
  vm.runInNewContext(source + "\nsharedOrder1 = order; sharedOwner1 = { cookie: 'fixture-owner' }; api = apiFixture; db = dbFixture; scope = scopeFixture;", sandbox);
  const context = { skip: reason => skipped.push(reason) };
  return { cases, state, skipped, context };
}

test('Sandbox simulator unsupported and failure paths never fabricate settlement or run dependent replay', async () => {
  for (const [options, reason] of [
    [{ qrisUrl: null }, 'SANDBOX_SIMULATOR_UNSUPPORTED'],
    [{ fetchResult: { ok: false } }, 'SANDBOX_SIMULATOR_HTTP_FAILED'],
    [{ fetchResult: new Error('synthetic-failure') }, 'SANDBOX_SIMULATOR_REQUEST_FAILED'],
    [{ providerState: 'pending' }, 'SANDBOX_PROVIDER_SETTLEMENT_UNCONFIRMED'],
  ]) {
    const fixture = await sandboxCases(options);
    await fixture.cases.get('sandbox: 03. sandbox settlement simulation if supported')(fixture.context);
    assert.equal(fixture.state.applies, 0);
    assert.deepEqual(fixture.skipped, [reason]);
    await fixture.cases.get('sandbox: 09. duplicate and delayed webhook replay in an isolated test environment')(fixture.context);
    assert.deepEqual(fixture.skipped, [reason, 'SANDBOX_PROVIDER_SETTLEMENT_REQUIRED']);
  }
});

test('Sandbox settlement applies the real provider paid status', async () => {
  const fixture = await sandboxCases({ providerState: 'paid' });
  await fixture.cases.get('sandbox: 03. sandbox settlement simulation if supported')(fixture.context);
  assert.equal(fixture.state.applies, 1);
  assert.equal(fixture.state.statuses, 1);
  assert.equal(fixture.state.reads, 1);
  assert.deepEqual(fixture.skipped, []);
});

test('Sandbox ownership case reads the current success/data invoice envelope', async () => {
  const fixture = await sandboxCases();
  await fixture.cases.get('sandbox: 10. signature, amount, currency, order_id and ownership validation')(fixture.context);
});

test('missing-order webhook returns 404 locally while Sandbox guards still refuse foreign invoice reads', async () => {
  const fixture = sandboxPolicy.fixtureScope(runId, true);
  const db = sandboxPolicy.guardedClient({ order: { findUnique: async () => { assert.fail('Foreign invoice reached the database'); } } }, fixture);
  await assert.rejects(db.order.findUnique({ where: { invoice: 'INV-nonexistent' } }), /SANDBOX_FIXTURE_SCOPE_REJECTED/);
  const script = `
    import assert from 'node:assert/strict';
    import crypto from 'node:crypto';
    let reads = 0;
    globalThis.prisma = { order: { findUnique: async ({ where }) => {
      assert.equal(where.invoice, 'INV-nonexistent'); reads++; return null;
    } } };
    globalThis.fetch = async () => { assert.fail('Missing order must not call a provider'); };
    const { POST } = await import(${JSON.stringify(new URL('../src/app/api/webhook/payment/route.ts', import.meta.url).href)});
    const payload = { order_id: 'INV-nonexistent', status_code: '200', gross_amount: '1000.00', transaction_status: 'settlement' };
    payload.signature_key = crypto.createHash('sha512').update(payload.order_id + payload.status_code + payload.gross_amount + process.env.MIDTRANS_SERVER_KEY).digest('hex');
    const response = await POST(new Request('https://staging-tests.invalid/api/webhook/payment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }));
    assert.equal(response.status, 404); assert.equal(reads, 1);
  `;
  const result = spawnSync(process.execPath, ['--import', new URL('./register.mjs', import.meta.url).href, '--input-type=module', '--eval', script], {
    env: { ...isolatedEnvironment(process.env), NODE_ENV: 'test', MIDTRANS_SERVER_KEY: 'synthetic-missing-order-test' }, encoding: 'utf8', windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
});

test('Sandbox reporter retains safe skip reasons while suppressing error payloads', async () => {
  async function* events() {
    yield { type: 'test:pass', data: { name: 'sandbox: 03. settlement', skip: 'SANDBOX_SIMULATOR_UNSUPPORTED' } };
    yield { type: 'test:fail', data: { name: 'sandbox: 03. settlement', details: { error: new Error('synthetic-secret-value') } } };
    yield { type: 'test:stdout', data: { message: 'synthetic-secret-value' } };
  }
  let output = '';
  for await (const line of sandboxReporter(events())) output += line;
  const rows = output.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows[0].result, 'SKIP');
  assert.equal(rows[0].reason, 'SANDBOX_SIMULATOR_UNSUPPORTED');
  assert.equal(rows[1].result, 'FAIL');
  assert.doesNotMatch(output, /synthetic-secret-value/);
});
