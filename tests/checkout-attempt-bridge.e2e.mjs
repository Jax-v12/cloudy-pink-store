// Browser consumer contract only: all API/external traffic is intercepted.
// A synthetic HttpOnly cookie is injected; this does NOT verify bootstrap issuance.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
// Secure cookie rules are preserved. This reserved HTTPS origin never reaches
// the network: documents/assets are fulfilled from the isolated localhost build.
const base = 'https://store.invalid';
const server = 'http://127.0.0.1:3144';
const output = path.resolve('.cache/login-qa/attempt-bridge');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jr1sAAAAASUVORK5CYII=', 'base64');
const credential = 'synthetic-browser-fixture'.padEnd(43, 'x');
const legacy = 'synthetic-legacy-fixture';
const order = { invoice: 'INV-BRIDGE-FIXTURE', type: 'ROBLOX', status: 'PENDING', totalAmount: 7000, productSubtotal: 7000,
  currency: 'IDR', pricingRegion: 'ID', paymentFee: 0, discount: 0, paymentMethod: 'QRIS', fulfillmentStatus: 'NOT_READY', refundStatus: 'NONE',
  variantName: 'Fixture package', units: 100, robloxDetail: { method: 'LOGIN', username: 'FixtureUser', gamepassPrice: null }, gameDetail: null,
  product: { name: 'Fixture Roblox' }, account: null, isAuthorized: true, qrisUrl: '/fixture-qr.png', qrisCode: null };
async function run(name, fn) {
  try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', reason: error.message.slice(0, 250) }); console.log(`FAIL ${name}: ${error.message.slice(0, 250)}`); }
}
async function fixture(viewport, mode = 'cookie') {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(({ mode, legacy }) => {
    localStorage.setItem('store_lang', 'EN');
    if (mode === 'legacy' || mode === 'invalid') localStorage.setItem('token_INV-BRIDGE-FIXTURE', mode === 'legacy' ? legacy : 'explicit-invalid');
  }, { mode, legacy });
  if (mode !== 'missing' && mode !== 'legacy') await context.addCookies([{ name: '__Host-cloudy_checkout', value: credential, url: base, httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const state = { detail: 0, payment: 0, qr: 0, deniedNetwork: 0, errors: 0 };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { state.deniedNetwork++; return route.abort(); }
    if (url.pathname === '/fixture-qr.png') return route.fulfill({ body: png, contentType: 'image/png' });
    if (!url.pathname.startsWith('/api/')) return route.fulfill({ response: await route.fetch({ url: server + url.pathname + url.search, maxRedirects: 0 }) });
    assert.ok(url.pathname.startsWith('/api/orders/INV-BRIDGE-FIXTURE'));
    const headers = await request.allHeaders();
    const hasHeader = 'x-order-token' in headers;
    const authorized = hasHeader ? headers['x-order-token'] === legacy : (headers.cookie ?? '').includes(`__Host-cloudy_checkout=${credential}`);
    if (!authorized) return route.fulfill({ status: 404, json: { success: false, errorCode: 'ORDER_NOT_FOUND' } });
    if (url.pathname.endsWith('/payment')) {
      assert.equal(request.method(), 'POST'); assert.equal(headers.origin, base); state.payment++;
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname.endsWith('/qris/download')) {
      state.qr++;
      return route.fulfill({ body: png, headers: { 'content-type': 'image/png', 'content-disposition': 'attachment; filename="fixture.png"' } });
    }
    state.detail++;
    return route.fulfill({ json: { success: true, data: order }, headers: { 'cache-control': 'private, no-store' } });
  });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  page.on('pageerror', () => state.errors++);
  return { page, context, state };
}
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }]) {
    await run(`${viewport.width} cookie-only invoice, refresh, reconciliation and QR without bearer storage`, async () => {
      const f = await fixture(viewport);
      try {
        let reconciled = f.page.waitForResponse(response => response.url().endsWith('/payment'));
        await f.page.goto(`${base}/order/${order.invoice}`); await f.page.getByRole('heading', { name: 'Order Details' }).waitFor(); await reconciled;
        const downloaded = f.page.waitForEvent('download');
        await f.page.getByRole('button', { name: 'Download QR Code', exact: true }).click(); await downloaded;
        assert.equal(f.state.qr, 1);
        reconciled = f.page.waitForResponse(response => response.url().endsWith('/payment'));
        await f.page.reload(); await f.page.getByRole('heading', { name: 'Order Details' }).waitFor(); await reconciled;
        const storage = await f.page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, visibleCookie: document.cookie }));
        for (const secret of [credential, 'checkoutKey', 'quoteToken', 'FixtureUser', 'accessToken', 'token_INV']) assert.equal(storage.includes(secret), false);
        assert.ok(f.state.detail >= 2); assert.ok(f.state.payment >= 2);
        assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
        await f.page.screenshot({ path: path.join(output, `${viewport.width}-cookie-invoice.png`), fullPage: true });
        assert.equal(f.state.errors, 0); assert.equal(f.state.deniedNetwork, 0);
      } finally { await f.context.close(); }
    });
  }
  for (const mode of ['missing', 'invalid', 'legacy']) {
    await run(`${mode} credential path preserves legacy precedence and refuses unauthorized invoice`, async () => {
      const f = await fixture({ width: 375, height: 812 }, mode);
      try {
        await f.page.goto(`${base}/order/${order.invoice}`);
        if (mode === 'legacy') await f.page.getByRole('heading', { name: 'Order Details' }).waitFor();
        else { await f.page.getByText('Order not found or access unavailable.', { exact: false }).waitFor(); assert.equal(f.state.payment, 0); }
        assert.equal(f.state.errors, 0); assert.equal(f.state.deniedNetwork, 0);
      } finally { await f.context.close(); }
    });
  }
} finally {
  await browser.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ PASS: results.filter(value => value.status === 'PASS').length, FAIL: results.filter(value => value.status === 'FAIL').length, SKIP: 0 }));
if (results.some(value => value.status === 'FAIL')) process.exitCode = 1;
