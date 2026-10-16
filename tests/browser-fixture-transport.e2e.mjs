// Real loopback TCP resets, no application/database/provider or account data.
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fulfillFixtureRead } from './browser-fixture-transport.mjs';
const { request } = createRequire(import.meta.url)(process.argv[2] || 'playwright');
const counts = new Map();
const server = http.createServer((req, res) => {
  const n = (counts.get(req.url) ?? 0) + 1; counts.set(req.url, n);
  if (req.url === '/always-reset.css' || (req.url === '/once-reset.css' && n === 1)) return req.socket.destroy();
  if (req.url === '/unavailable.css') { res.writeHead(503); return res.end('unavailable'); }
  if (req.url === '/redirect.css') { res.writeHead(302, { location: '/redirect-target.css' }); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/css' }); res.end('body { color: black; }');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const api = await request.newContext({ timeout: 3000 });
let pass = 0, fail = 0;
async function run(name, work) {
  try { await work(); pass++; console.log('PASS ' + name); }
  catch (error) { fail++; console.log('FAIL ' + name + ' (' + error.name + ')'); }
}
function route(path, method = 'GET') {
  let status = null, body = null;
  return {
    request: () => ({ url: () => 'https://store.invalid' + path, method: () => method }),
    fetch: options => api.fetch(options.url, { ...options, method }),
    fulfill: async ({ response }) => { status = response.status(); body = await response.text(); },
    status: () => status, body: () => body,
  };
}
try {
  await run('one transient TCP reset recovers the same read', async () => {
    const r = route('/once-reset.css'); await fulfillFixtureRead(r, origin);
    assert.equal(r.status(), 200); assert.match(r.body(), /color: black/); assert.equal(counts.get('/once-reset.css'), 2);
  });
  await run('persistent TCP reset fails after the bounded retry', async () => {
    await assert.rejects(fulfillFixtureRead(route('/always-reset.css'), origin), /ECONNRESET/);
    assert.equal(counts.get('/always-reset.css'), 2);
  });
  await run('HTTP failures are preserved without retry', async () => {
    const r = route('/unavailable.css'); await fulfillFixtureRead(r, origin);
    assert.equal(r.status(), 503); assert.equal(counts.get('/unavailable.css'), 1);
  });
  await run('redirects are preserved and never followed', async () => {
    const r = route('/redirect.css'); await fulfillFixtureRead(r, origin);
    assert.equal(r.status(), 302); assert.equal(counts.get('/redirect.css'), 1); assert.equal(counts.has('/redirect-target.css'), false);
  });
  await run('API paths and mutation methods never reach the proxy', async () => {
    const before = [...counts.values()].reduce((a, b) => a + b, 0);
    for (const [p, m] of [['/api/checkout', 'GET'], ['/api', 'GET'], ['/page', 'POST']]) {
      await assert.rejects(fulfillFixtureRead(route(p, m), origin), /UNSAFE_FIXTURE_PROXY_REQUEST/);
    }
    assert.equal([...counts.values()].reduce((a, b) => a + b, 0), before);
  });
  await run('non-local destinations are refused before a request', async () => {
    await assert.rejects(fulfillFixtureRead(route('/page'), 'https://example.invalid'), /UNSAFE_FIXTURE_PROXY_REQUEST/);
  });
} finally {
  await api.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
console.log(JSON.stringify({ PASS: pass, FAIL: fail, SKIP: 0 }));
if (fail) process.exitCode = 1;
