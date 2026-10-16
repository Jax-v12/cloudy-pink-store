import test from 'node:test';
import assert from 'node:assert/strict';
import { runStoreCron } from '../scripts/run-store-cron.mjs';

const env = { STORE_CRON_ORIGIN: 'https://store.example.invalid', CRON_SECRET: 'synthetic-cron-secret', VERCEL_AUTOMATION_BYPASS_SECRET: 'synthetic-bypass' };
const noWait = async () => {};

test('cron invokes both existing endpoints with private headers and no secret in URLs', async () => {
  const calls = [];
  await runStoreCron(env, async (url, options) => { calls.push({ url: String(url), options }); return Response.json({ success: true }); }, noWait);
  assert.deepEqual(calls.map(row => row.url), ['/api/cron/cleanup', '/api/cron/fulfillment'].map(path => env.STORE_CRON_ORIGIN + path));
  for (const { options } of calls) {
    assert.equal(options.headers.Authorization, 'Bearer ' + env.CRON_SECRET);
    assert.equal(options.headers['x-vercel-protection-bypass'], env.VERCEL_AUTOMATION_BYPASS_SECRET);
    assert.equal(options.redirect, 'manual'); assert.equal(options.cache, 'no-store');
  }
});

test('transient cron failures retry at most three times and still run the other endpoint', async () => {
  const calls = [];
  await assert.rejects(runStoreCron(env, async url => {
    calls.push(url.pathname);
    if (url.pathname.endsWith('cleanup')) throw new Error(env.CRON_SECRET);
    return Response.json({ success: true });
  }, noWait), /^Error: CRON_RUN_FAILED$/);
  assert.equal(calls.filter(path => path.endsWith('cleanup')).length, 3);
  assert.equal(calls.filter(path => path.endsWith('fulfillment')).length, 1);
});

test('redirect, denied auth and false-success responses fail closed without retry', async () => {
  for (const response of [() => new Response(null, { status: 302, headers: { Location: 'https://foreign.invalid' } }), () => new Response(null, { status: 401 }), () => Response.json({ success: false }), () => new Response('<html>login</html>')]) {
    let calls = 0;
    await assert.rejects(runStoreCron(env, async () => { calls++; return response(); }, noWait), /CRON_RUN_FAILED/);
    assert.equal(calls, 2);
  }
});

test('invalid cron configuration never sends credentials', async () => {
  for (const origin of ['', 'http://store.invalid', 'https://user:pass@store.invalid', 'https://store.invalid/other', 'https://store.invalid?secret=value', 'https://localhost', 'https://127.0.0.1']) {
    let calls = 0;
    await assert.rejects(runStoreCron({ ...env, STORE_CRON_ORIGIN: origin }, async () => { calls++; }, noWait), /CRON_CONFIG_INVALID/);
    assert.equal(calls, 0);
  }
  await assert.rejects(runStoreCron({ ...env, CRON_SECRET: '' }, async () => {}, noWait), /CRON_CONFIG_INVALID/);
});
