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
