// UI fixtures only: every API and external request is intercepted; no DB or provider access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const server = process.argv[3] || 'http://127.0.0.1:3156';
assert.equal(new URL(server).hostname, '127.0.0.1');
const base = server;
const output = path.resolve('.cache/service-help-20261018/browser');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const filter = process.argv.find(value => value.startsWith('--case='))?.slice(7);
const labels = {
  ID: { faq: 'Pertanyaan umum', terms: 'Ketentuan layanan', comparison: 'Bandingkan metode Roblox', progress: 'Progres pesanan', queued: 'Masuk antrean', completed: 'Selesai' },
  EN: { faq: 'Frequently asked questions', terms: 'Service terms', comparison: 'Compare Roblox methods', progress: 'Order progress', queued: 'In queue', completed: 'Completed' },
  MY: { faq: 'Soalan lazim', terms: 'Syarat perkhidmatan', comparison: 'Bandingkan kaedah Roblox', progress: 'Kemajuan pesanan', queued: 'Dalam giliran', completed: 'Selesai' },
};
const order = {
  invoice: 'INV-SYNTHETIC-PROGRESS', type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'QUEUED', refundStatus: 'NONE',
  variantName: 'Synthetic 100 Robux', units: 100, totalAmount: 8500, productSubtotal: 8500, currency: 'IDR', pricingRegion: 'ID',
  paymentFee: 0, discount: 0, paymentMethod: 'QRIS', qrisUrl: null, qrisCode: null, expiresAt: '2099-01-01T00:00:00.000Z',
  product: { name: 'Synthetic Roblox' }, account: null, gameDetail: null, isAuthorized: true,
  robloxDetail: { method: 'GIFT_USERNAME', username: 'FixtureUser', gamepassPrice: null },
};
async function fixture(viewport, locale, patch = {}, region = 'ID') {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(locale => localStorage.setItem('store_lang', locale), locale);
  const state = { blocked: 0, errors: 0, mutations: 0, order: { ...order, ...patch } };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { state.blocked++; return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/products' && request.method() === 'GET') {
      const products = url.searchParams.get('type') === 'ROBLOX' ? [{ id: 1, name: 'Synthetic Roblox', slug: 'synthetic-roblox', checkoutEnabled: true,
        variants: ['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'].map((method, index) => ({ id: index + 1, name: method, method, units: 100, price: region ? 8500 : null, unitStep: 5, maxUnits: 1000 })) }] : [];
      return route.fulfill({ json: { success: true, data: products, location: { region }, paymentMethods: [], pagination: { nextCursor: null } } });
    }
    if (url.pathname === `/api/orders/${order.invoice}` && request.method() === 'GET') return route.fulfill({ json: { success: true, data: state.order } });
    if (url.pathname === `/api/orders/${order.invoice}/payment` && request.method() === 'POST') return route.fulfill({ json: { success: true } });
    if (request.method() !== 'GET') state.mutations++;
    state.blocked++; return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', () => state.errors++);
  return { context, page, state };
}
async function run(name, fn) {
  if (filter && !name.includes(filter)) return;
  try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); console.log(`FAIL ${name}: ${error.message.slice(0, 350)}`); }
}
async function clean(f) {
  assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow');
  assert.equal(f.state.errors, 0, 'browser errors'); assert.equal(f.state.blocked, 0, 'unexpected request'); assert.equal(f.state.mutations, 0, 'unexpected mutation');
}
async function close(f) {
  // Drain asset/prefetch route handlers before disposing their APIResponse objects.
  await f.context.unrouteAll({ behavior: 'wait' });
  await f.context.close();
}
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }]) for (const locale of ['ID', 'EN', 'MY']) {
    const l = labels[locale];
    await run(`${viewport.width} ${locale}: FAQ, keyboard and terms links`, async () => {
      const f = await fixture(viewport, locale);
      try {
        await f.page.goto(base + '/apps');
        await f.page.getByRole('link', { name: l.faq, exact: true }).click();
        await f.page.getByRole('heading', { name: l.faq, exact: true }).waitFor();
        assert.equal(await f.page.locator('details').count(), 8);
        const summary = f.page.locator('summary').first(); await summary.focus(); await f.page.keyboard.press('Enter');
        await f.page.waitForFunction(() => document.querySelector('details')?.open === true);
        await f.page.keyboard.press('Enter');
        await f.page.waitForFunction(() => document.querySelector('details')?.open === false);
        await f.page.getByRole('link', { name: l.terms, exact: true }).first().click();
        await f.page.waitForURL('**/help#terms');
        assert.equal(await f.page.locator('#terms').isVisible(), true);
        await clean(f);
        await f.page.evaluate(() => window.scrollTo(0, 0));
        await f.page.screenshot({ path: path.join(output, `${viewport.width}-${locale}-help.png`), fullPage: true });
      } finally { await close(f); }
    });
    await run(`${viewport.width} ${locale}: three-method comparison keeps separate checkout links`, async () => {
      const f = await fixture(viewport, locale);
      try {
        await f.page.goto(base + '/roblox');
        const comparison = f.page.getByRole('region', { name: l.comparison, exact: true });
        await comparison.waitFor();
        assert.equal(await comparison.locator('article').count(), 3);
        assert.equal(await comparison.locator('dt').count(), 9);
        for (const method of ['GAMEPASS', 'LOGIN', 'GIFT_USERNAME']) assert.equal(await comparison.locator(`a[href="/roblox/synthetic-roblox?method=${method}"]`).count(), 1);
        assert.equal(await comparison.locator('select').count(), 0);
        await clean(f);
        await f.page.screenshot({ path: path.join(output, `${viewport.width}-${locale}-comparison.png`), fullPage: true });
      } finally { await close(f); }
    });
    await run(`${viewport.width} ${locale}: paid invoice shows queue and updates after delivery`, async () => {
      const f = await fixture(viewport, locale);
      try {
        await f.page.goto(base + `/order/${order.invoice}`);
        const progress = f.page.getByRole('region', { name: l.progress, exact: true });
        await progress.waitFor();
        assert.equal(await progress.locator('[aria-current=step]').count(), 1);
        assert.ok((await progress.locator('[aria-current=step]').innerText()).includes(l.queued));
        await clean(f);
        await f.page.screenshot({ path: path.join(output, `${viewport.width}-${locale}-progress.png`), fullPage: true });
        f.state.order.fulfillmentStatus = 'COMPLETED';
        await f.page.waitForFunction(label => document.querySelector('[aria-current=step]')?.textContent.includes(label), l.completed);
        assert.equal(await progress.locator('li').count(), 4);
        await progress.getByRole('link').click();
        await f.page.waitForURL('**/help#order-status');
        await clean(f);
      } finally { await close(f); }
    });
  }
  for (const patch of [
    { status: 'PENDING', fulfillmentStatus: 'COMPLETED' },
    { fulfillmentStatus: 'WAITING_CUSTOMER' }, { fulfillmentStatus: 'REQUIRES_REVIEW' }, { fulfillmentStatus: 'NOT_READY' },
    { status: 'EXPIRED', fulfillmentStatus: 'COMPLETED' }, { status: 'CANCELLED', fulfillmentStatus: 'COMPLETED' },
    { refundStatus: 'REQUIRED', fulfillmentStatus: 'COMPLETED' }, { refundStatus: 'COMPLETED', fulfillmentStatus: 'COMPLETED' },
    { type: 'APPS', fulfillmentStatus: 'COMPLETED', account: null, robloxDetail: null },
  ]) await run(`invoice edge state ${JSON.stringify(patch)}`, async () => {
    const f = await fixture({ width: 375, height: 812 }, 'EN', patch);
    try {
      await f.page.goto(base + `/order/${order.invoice}`);
      const progress = f.page.getByRole('region', { name: labels.EN.progress, exact: true }); await progress.waitFor();
      const current = progress.locator('[aria-current=step]');
      if (patch.status === 'PENDING') assert.match(await current.innerText(), /Payment/);
      else if (patch.type === 'APPS') { assert.equal(await progress.locator('li').count(), 3); assert.match(await current.innerText(), /Preparing account/); }
      else if (patch.fulfillmentStatus === 'WAITING_CUSTOMER') { assert.match(await current.innerText(), /Processing/); assert.match(await progress.getByRole('status').innerText(), /participation/); }
      else assert.equal(await current.count(), 0);
      await clean(f);
    } finally { await close(f); }
  });
  await run('unknown region retains comparison and disables all checkout links', async () => {
    const f = await fixture({ width: 375, height: 812 }, 'EN', {}, null);
    try {
      await f.page.goto(base + '/roblox');
      const comparison = f.page.getByRole('region', { name: labels.EN.comparison, exact: true }); await comparison.waitFor();
      assert.equal(await comparison.locator('article').count(), 3);
      assert.equal(await comparison.locator('a[href*="method="]').count(), 0);
      await clean(f);
    } finally { await close(f); }
  });
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, filter ? 'results-filtered.json' : 'results.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length }));
if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
