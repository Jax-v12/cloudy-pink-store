// Browser/UI regression only: APIs are fixtures; no remote DB, order or provider call.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const server = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3144';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(server).hostname));
const base = server;
const output = path.resolve('.cache/interaction-20261028/browser');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const filter = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const viewports = [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }];
const products = [1, 2].map(id => ({ id, slug: `fixture-${id}`, name: `Fixture Roblox ${id}`, checkoutEnabled: true,
  variants: ['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'].map((method, index) => ({ id: id * 10 + index, method, name: '100 Robux', price: id * 8500, units: 100, maxUnits: 1000, unitStep: 5 })) }));
async function fixture(viewport, locale = 'ID', reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion, serviceWorkers: 'block' });
  await context.addInitScript(locale => localStorage.setItem('store_lang', locale), locale);
  const state = { errors: 0, unexpected: [], quotes: 0, checkouts: [], checkoutMode: 'failure' };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { state.unexpected.push('external'); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/products') return route.fulfill({ json: { success: true,
      data: url.searchParams.get('type') === 'ROBLOX' ? products.filter(p => !url.searchParams.has('slug') || p.slug === url.searchParams.get('slug')) : [],
      location: { region: 'ID' }, paymentMethods: [{ id: 'qris', label: 'QRIS' }], pagination: { nextCursor: null } } });
    if (url.pathname === '/api/checkout/quote') {
      state.quotes++;
      const body = request.postDataJSON(), variant = products.flatMap(p => p.variants).find(v => v.id === body.variantId);
      const subtotal = variant.price * (body.quantity || variant.units) / variant.units;
      return route.fulfill({ json: { success: true, data: { productSubtotal: subtotal, paymentFee: 0, discount: 0, totalAmount: subtotal, pricingRegion: 'ID', quoteToken: 'fixture-only' } } });
    }
    if (url.pathname === '/api/roblox/user') return route.fulfill({ json: { success: true, data: { id: 42, name: 'FixtureUser', displayName: 'Fixture User', avatarUrl: null } } });
    if (url.pathname === '/api/checkout' && request.method() === 'POST') {
      state.checkouts.push({ body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
      await new Promise(resolve => setTimeout(resolve, 150));
      return state.checkoutMode === 'failure'
        ? route.fulfill({ status: 503, json: { success: false, errorCode: 'SYSTEM_ERROR' } })
        : route.fulfill({ json: { success: true, data: { invoice: 'INV-FIXTURE-INTERACTION', accessToken: 'synthetic-only' } } });
    }
    if (url.pathname === '/api/orders/INV-FIXTURE-INTERACTION') return route.fulfill({ json: { success: true, data: {
      invoice: 'INV-FIXTURE-INTERACTION', type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'QUEUED', refundStatus: 'NONE',
      variantName: '100 Robux', units: 100, totalAmount: 8500, productSubtotal: 8500, currency: 'IDR', pricingRegion: 'ID',
      paymentFee: 0, discount: 0, paymentMethod: 'QRIS', qrisUrl: null, qrisCode: null, expiresAt: '2099-01-01T00:00:00.000Z',
      product: { name: 'Fixture Roblox' }, account: null, gameDetail: null, isAuthorized: true,
      robloxDetail: { method: 'GIFT_USERNAME', username: 'FixtureUser', gamepassPrice: null },
    } } });
    state.unexpected.push(request.method() + ' ' + url.pathname);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', () => state.errors++);
  return { page, context, state };
}
async function clean(f) {
  assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow');
  assert.equal(f.state.errors, 0, 'browser errors');
  assert.deepEqual(f.state.unexpected, [], 'unexpected API/external request');
}
async function close(f) { await f.context.unrouteAll({ behavior: 'wait' }); await f.context.close(); }
async function run(name, fn) {
  if (filter && !name.includes(filter)) return;
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); console.log('FAIL ' + name + ': ' + error.message.slice(0, 350)); }
}
async function toggleHeights(details) {
  return details.evaluate(async el => {
    const heights = [el.getBoundingClientRect().height];
    el.querySelector('summary').click();
    const start = performance.now();
    while (performance.now() - start < 350) {
      await new Promise(requestAnimationFrame);
      heights.push(el.getBoundingClientRect().height);
    }
    return heights;
  });
}
function animated(heights) {
  const low = Math.min(heights[0], heights.at(-1)), high = Math.max(heights[0], heights.at(-1));
  assert.ok(high - low > 40, 'detail must expand/collapse');
  assert.ok(heights.some(height => height > low + 2 && height < high - 2), 'detail height must pass through intermediate sizes');
}
try {
  for (const viewport of viewports) for (const locale of ['ID', 'EN', 'MY']) {
    await run(`${viewport.width} ${locale} card dropdown touch target and stable neighbours`, async () => {
      const f = await fixture(viewport, locale);
      try {
        await f.page.goto(base + '/roblox');
        const cards = f.page.locator('article'), summary = cards.first().locator('summary');
        await summary.waitFor();
        assert.ok((await summary.boundingBox()).height >= 44, 'dropdown touch target must be at least 44px tall');
        // Focus can scroll an off-screen disclosure; compare document positions, not viewport positions.
        const before = await cards.evaluateAll(els => els.map(el => ({ height: el.getBoundingClientRect().height, y: el.getBoundingClientRect().y + window.scrollY })));
        await summary.focus(); await f.page.keyboard.press('Enter');
        await f.page.waitForFunction(() => document.querySelector('article details')?.open);
        await f.page.waitForTimeout(300);
        if (viewport.width >= 1024) {
          const after = await cards.evaluateAll(els => els.map(el => ({ height: el.getBoundingClientRect().height, y: el.getBoundingClientRect().y + window.scrollY })));
          for (const index of [1, 2]) assert.ok(Math.abs(after[index].height - before[index].height) < 1 && Math.abs(after[index].y - before[index].y) < 1, 'opening one card must not resize/move its neighbours');
        }
        await f.page.keyboard.press('Space');
        await f.page.waitForFunction(() => !document.querySelector('article details')?.open);
        assert.equal(await summary.evaluate(el => document.activeElement === el), true, 'keyboard focus retained');
        const select = cards.first().getByRole('combobox');
        await select.selectOption('2');
        assert.match(await cards.first().locator('a[href*="method="]').getAttribute('href'), /fixture-2\?method=GAMEPASS$/);
        assert.match(await cards.nth(1).locator('a[href*="method="]').getAttribute('href'), /fixture-1\?method=LOGIN$/);
        assert.equal(f.state.quotes, 0, 'card selection does not request checkout');
        await clean(f);
        await f.page.screenshot({ path: path.join(output, `${viewport.width}-${locale}-cards.png`), fullPage: true });
      } finally { await close(f); }
    });
  }
  await run('dropdown opening and closing animate, including rapid reversal', async () => {
    const f = await fixture(viewports[2]);
    try {
      await f.page.goto(base + '/roblox');
      const details = f.page.locator('article details').first(); await details.waitFor();
      animated(await toggleHeights(details));
      animated(await toggleHeights(details));
      await details.locator('summary').evaluate(async el => {
        for (let i = 0; i < 7; i++) { el.click(); await new Promise(requestAnimationFrame); }
      });
      await f.page.waitForTimeout(300);
      assert.equal(await details.evaluate(el => el.open), true);
      assert.equal(await details.locator('dd').first().isVisible(), true);
      await clean(f);
    } finally { await close(f); }
  });
  await run('reduced motion keeps native dropdown keyboard behaviour', async () => {
    const f = await fixture(viewports[0], 'ID', 'reduce');
    try {
      await f.page.goto(base + '/roblox');
      const details = f.page.locator('article details').first(); await details.waitFor();
      const heights = await toggleHeights(details);
      assert.ok(Math.abs(heights[1] - heights.at(-1)) < 1, 'reduced motion opens without animation: ' + JSON.stringify(heights.slice(0, 6).concat(heights.at(-1))));
      await details.locator('summary').focus(); await f.page.keyboard.press('Enter');
      await f.page.waitForFunction(() => !document.querySelector('article details')?.open);
      await clean(f);
    } finally { await close(f); }
  });
  for (const method of ['GAMEPASS', 'GIFT_USERNAME']) await run(`${method} wizard back restores heading focus and preserves draft`, async () => {
    const f = await fixture(viewports[0], 'EN');
    try {
      await f.page.goto(base + `/roblox/fixture-1?method=${method}`);
      const form = f.page.locator('form'); await form.locator('button[type=submit]').waitFor();
      await form.locator('button[type=submit]').click();
      await f.page.locator('input[name=username]').fill('FixtureUser');
      await form.locator('input[type=email]').fill('fixture@example.invalid');
      await f.page.locator('ol button').first().click();
      assert.equal(await form.locator('h2').evaluate(el => document.activeElement === el), true, 'back must focus current heading');
      await form.locator('button[type=submit]').click();
      assert.equal(await f.page.locator('input[name=username]').inputValue(), 'FixtureUser');
      assert.equal(await form.locator('input[type=email]').inputValue(), 'fixture@example.invalid');
      await clean(f);
    } finally { await close(f); }
  });
  for (const viewport of viewports) for (const method of ['GAMEPASS', 'GIFT_USERNAME']) await run(`${viewport.width} ${method} complete wizard, guide, failed submit and safe retry`, async () => {
    const f = await fixture(viewport, 'EN');
    try {
      await f.page.goto(base + `/roblox/fixture-1?method=${method}`);
      const form = f.page.locator('form'), next = form.locator('button[type=submit]');
      await next.click();
      await f.page.locator('input[name=username]').fill('FixtureUser');
      await f.page.getByRole('button', { name: 'Check username', exact: true }).click();
      await f.page.getByText('Fixture User', { exact: false }).first().waitFor();
      await form.locator('input[type=email]').fill('fixture@example.invalid');
      await form.locator('input[type=number]').fill('200');
      await next.click();
      if (method === 'GAMEPASS') {
        const guide = form.getByRole('button', { name: 'How to create a Gamepass', exact: true });
        await guide.click();
        const dialog = f.page.getByRole('dialog'); await dialog.waitFor();
        await f.page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
        assert.equal(await guide.evaluate(el => el === document.activeElement), true, 'guide returns focus');
        await form.locator('input[type=url]').fill('https://www.roblox.com/game-pass/123456789');
        await next.click();
      }
      await form.locator('input[name=payment]').check(); await next.click();
      assert.equal(f.state.checkouts.length, 0, 'wizard steps never create orders');
      await next.evaluate(el => { el.click(); el.click(); });
      await form.getByRole('alert').waitFor();
      assert.equal(f.state.checkouts.length, 1, 'double click sends once');
      assert.equal(f.state.checkouts[0].body.quantity, 200);
      assert.equal('gamepassUrl' in f.state.checkouts[0].body.details, method === 'GAMEPASS');
      await clean(f);
      await f.page.screenshot({ path: path.join(output, `${viewport.width}-${method}-retry.png`), fullPage: true });
      f.state.checkoutMode = 'success';
      await next.evaluate(el => { el.click(); el.click(); });
      await f.page.waitForURL('**/order/INV-FIXTURE-INTERACTION');
      assert.equal(f.state.checkouts.length, 2);
      assert.equal(f.state.checkouts[0].key, f.state.checkouts[1].key, 'same payload retains idempotency key');
      await f.page.getByRole('region', { name: 'Order progress', exact: true }).waitFor();
      await clean(f);
    } finally { await close(f); }
  });
  await run('help dropdown animation and recent-orders keyboard dismissal', async () => {
    const f = await fixture(viewports[0], 'EN');
    try {
      await f.page.goto(base + '/help');
      const details = f.page.locator('details').first(); await details.waitFor();
      animated(await toggleHeights(details)); animated(await toggleHeights(details));
      const trigger = f.page.getByRole('button', { name: translations.EN.recentOrdersBtn, exact: true });
      await trigger.click();
      const dialog = f.page.getByRole('dialog'); await dialog.waitFor();
      await f.page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
      await f.page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      await clean(f);
    } finally { await close(f); }
  });
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, filter ? 'results-filtered.json' : 'results.json'), JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length }));
if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
