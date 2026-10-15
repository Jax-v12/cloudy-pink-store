// Run against an isolated, secret-free local app. No production URLs or database fixtures.
// P0C_PLAYWRIGHT_MODULE may point to a locally installed Playwright entry point.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.P0C_PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const base = process.env.P0C_BASE_URL || process.argv[3] || 'http://127.0.0.1:3124';
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = path.resolve(process.env.P0C_OUTPUT || '.cache/p0c-qa/screenshots');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...((process.env.P0C_BROWSER_CHANNEL || process.argv[4]) ? { channel: process.env.P0C_BROWSER_CHANNEL || process.argv[4] } : {}) });
const results = [];
const money = (amount, region = 'ID') => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: { ID: 'IDR', MY: 'MYR', PH: 'PHP' }[region],
  currencyDisplay: 'narrowSymbol', minimumFractionDigits: region === 'ID' ? 0 : 2,
}).format(region === 'ID' ? amount : amount / 100);
const viewports = [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }];
function catalog(region = 'ID', mode = 'normal') {
  const prices = { ID: [12500, 9500, 24000, 48000, 96000, 192000], MY: [721, 519, 1429, 2858, 5716, 11432], PH: [9133, 5123, 18321, 36642, 73284, 146568] }[region || 'ID'];
  let variants = ['GAMEPASS', 'GIFT_USERNAME', 'LOGIN', 'LOGIN', 'LOGIN', 'LOGIN'].map((method, i) => ({
    id: i + 11, name: `${[100, 50, 160, 320, 640, 1280][i]} Robux`, method,
    units: [100, 50, 160, 320, 640, 1280][i], maxUnits: i < 2 ? 1000 : null, unitStep: 5,
    requiresZone: false, gamepassPrice: null,
    price: region ? prices[i] : null,
    regionalPrices: region && region !== 'ID' ? [{ region, amount: prices[i], active: true }] : [],
  }));
  if (mode === 'empty') variants = variants.filter(v => v.method !== 'LOGIN');
  if (mode === 'null') variants = variants.map(v => ({ ...v, price: null, regionalPrices: [] }));
  return { success: true, location: { region }, paymentMethods: region === 'ID' ? [{ id: 'qris', label: 'QRIS' }] : [],
    pagination: { nextCursor: null }, data: mode === 'no-products' ? [] : [{ id: 9001, slug: 'qa-roblox', name: 'QA Roblox', type: 'ROBLOX', checkoutEnabled: region === 'ID', variants }] };
}
async function fixture(viewport, options = {}) {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(language => localStorage.setItem('store_lang', language), options.language || 'EN');
  const state = { catalog: catalog(options.region === undefined ? 'ID' : options.region, options.mode), quoteCalls: [], forbidden: [], errors: [], lookup: 'ok', quoteFailure: false };
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) { state.forbidden.push(url.origin); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    let data;
    if (url.pathname === '/api/products') {
      data = state.catalog;
      if (url.searchParams.get('type') === 'GAME') data = { ...data, data: [{ id: 9002, slug: 'qa-game', name: 'QA Game', checkoutEnabled: false, variants: [{ id: 21, name: 'QA Package', price: 23000, units: 100, requiresZone: true }] }] };
      if (!url.searchParams.get('type')) data = { success: true, pagination: { nextCursor: null }, data: [{ id: 9003, slug: 'qa-app', name: 'QA Apps Premium', price: 31000, stockAvailable: 2 }] };
    } else if (url.pathname === '/api/checkout/quote') {
      const body = route.request().postDataJSON(); state.quoteCalls.push(body);
      if (state.quoteFailure) return route.fulfill({ status: 409, json: { success: false, errorCode: 'PRICE_CHANGED' } });
      const variant = state.catalog.data[0].variants.find(v => v.id === body.variantId);
      const subtotal = Math.ceil(variant.price * (body.quantity || variant.units) / variant.units);
      data = { success: true, data: { productSubtotal: subtotal, paymentFee: 750, discount: 0, totalAmount: subtotal + 750, pricingRegion: state.catalog.location.region, quoteToken: 'isolated-browser-fixture' } };
    } else if (url.pathname === '/api/roblox/user') {
      if (state.lookup !== 'ok') return route.fulfill({ status: state.lookup === 'missing' ? 404 : 503, json: { success: false, errorCode: state.lookup === 'missing' ? 'ROBLOX_USER_NOT_FOUND' : 'ROBLOX_UNAVAILABLE' } });
      data = { success: true, data: { id: 42, name: 'FixtureUser', displayName: 'Fixture User', avatarUrl: null } };
    } else { state.forbidden.push(url.pathname); return route.abort(); }
    return route.fulfill({ status: 200, json: data });
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  page.on('pageerror', error => state.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) state.errors.push(message.text()); });
  async function goto(url) { await page.goto(base + url); await page.waitForFunction(() => !document.body.innerText.includes('Loading catalog')); await page.locator('h1,h2').first().waitFor(); }
  async function shot(name) { await page.screenshot({ path: path.join(output, `${viewport.width}-${name}.png`), fullPage: true }); }
  async function clean() { assert.deepEqual(state.forbidden, [], 'Unexpected API/external request'); assert.deepEqual(state.errors, [], 'Browser errors'); }
  return { context, page, state, goto, shot, clean };
}
async function test(name, fn) { try { await fn(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); } catch (error) { results.push({ name, status: 'FAIL', reason: error.message }); console.log(`FAIL ${name}: ${error.message.slice(0, 700)}`); } }
async function noOverflow(page) {
  const bad = await page.locator('main label, main h1, main h2, main button, main dd, main p').evaluateAll(elements => elements.filter(el => {
    const rect = el.getBoundingClientRect(); const style = getComputedStyle(el);
    return rect.width > 1 && style.position !== 'absolute' && (rect.right > innerWidth + 1 || rect.left < -1 || (el.scrollWidth > el.clientWidth + 2 && style.overflowX === 'visible'));
  }).map(el => ({ tag: el.tagName, text: el.textContent.slice(0, 60), width: el.clientWidth, scroll: el.scrollWidth })));
  assert.deepEqual(bad, [], 'Visible content overflows');
}
try {
  await test('Roblox critical text contrast', async () => {
    const f = await fixture(viewports[0]); try {
      await f.goto('/roblox/qa-roblox?method=GAMEPASS'); await f.page.locator('ol button').first().waitFor();
      const readings = await f.page.evaluate(() => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const rgb = color => { ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const luminance = color => rgb(color).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
        const contrast = (a, b) => { const x = luminance(a); const y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        return ['form button[type=submit]', 'ol button span:first-child', 'form p.text-center'].flatMap(selector => [...document.querySelectorAll(selector)].map(el => {
          const s = getComputedStyle(el);
          const backgrounds = s.backgroundImage !== 'none' ? [s.getPropertyValue('--tw-gradient-from'), s.getPropertyValue('--tw-gradient-to')] : [s.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#f2f2f2' : s.backgroundColor];
          return { text: el.textContent.slice(0, 70), ratio: Math.min(...backgrounds.map(bg => contrast(s.color, bg))) };
        }));
      });
      await fs.writeFile(path.join(output, 'contrast.json'), JSON.stringify(readings, null, 2));
      assert.deepEqual(readings.filter(r => r.ratio < 4.5), [], 'Text contrast below 4.5:1');
    } finally { await f.context.close(); }
  });
  for (const viewport of viewports) {
    await test(`${viewport.width} landing, methods, navigation`, async () => {
      const f = await fixture(viewport); try {
        await f.goto('/roblox'); await f.page.locator('article').first().waitFor();
        assert.equal(await f.page.locator('article').count(), 3); await noOverflow(f.page); await f.shot('landing');
        for (const method of ['GAMEPASS', 'LOGIN', 'GIFT_USERNAME']) {
          await f.page.locator(`a[href$="method=${method}"]`).click();
          await f.page.waitForURL(`**method=${method}`); await f.page.locator('h1').waitFor();
          assert.equal(await f.page.getByRole('tab').count(), 0);
          assert.equal(await f.page.getByText('1. Choose a method', { exact: true }).count(), 0);
          await f.goto('/roblox'); await f.page.locator('article').first().waitFor();
        }
        await f.clean();
      } finally { await f.context.close(); }
    });
    await test(`${viewport.width} Login cards, quote, keyboard, layout`, async () => {
      const f = await fixture(viewport); try {
        await f.goto('/roblox/qa-roblox?method=LOGIN');
        const cards = f.page.locator('input[name=package]'); await cards.first().waitFor({ state: 'attached' });
        assert.equal(await cards.count(), 4);
        await cards.first().focus(); await f.page.keyboard.press('Space');
        assert.equal(f.state.quoteCalls.length, 0);
        await cards.first().focus(); await f.page.keyboard.press('ArrowRight');
        await f.page.waitForFunction(() => document.querySelector('input[value="14"]')?.checked);
        assert.equal(await f.page.locator('input[name=package]:checked').count(), 1);
        assert.equal(await f.page.locator('input[type=password]').count(), 0);
        await f.shot('login-selected'); await noOverflow(f.page);
        const grid = await cards.first().evaluate(el => getComputedStyle(el.parentElement.parentElement).gridTemplateColumns.split(' ').length);
        assert.ok(grid >= (viewport.width === 1440 ? 3 : 2), `Only ${grid} card columns`);
        await f.clean();
      } finally { await f.context.close(); }
    });
    for (const method of ['GAMEPASS', 'GIFT_USERNAME']) await test(`${viewport.width} ${method} wizard and draft`, async () => {
      const f = await fixture(viewport); try {
        await f.goto(`/roblox/qa-roblox?method=${method}`); await f.page.locator('ol button').first().waitFor();
        assert.equal(await f.page.locator('ol button').count(), method === 'GAMEPASS' ? 5 : 4);
        await f.shot(`${method.toLowerCase()}-intro`); await noOverflow(f.page);
        if (method === 'GIFT_USERNAME') assert.ok(!(await f.page.locator('h1 + p').innerText()).includes('Gamepass'), 'Username hero describes Gamepass');
        await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
        await f.page.locator('input[name=username]').fill('FixtureUser');
        await f.page.getByRole('button', { name: 'Check username', exact: true }).click();
        await f.page.getByText('Fixture User', { exact: false }).first().waitFor();
        await f.page.locator('input[type=email]').fill('fixture@example.invalid');
        await f.page.locator('input[type=number]').fill('200');
        await f.page.getByRole('button', { name: 'Back', exact: true }).click();
        await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
        assert.equal(await f.page.locator('input[name=username]').inputValue(), 'FixtureUser');
        assert.equal(await f.page.locator('input[type=number]').inputValue(), '200');
        assert.equal(await f.page.locator('input[type=email]').inputValue(), 'fixture@example.invalid');
        await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
        if (method === 'GAMEPASS') {
          assert.ok((await f.page.locator('form').innerText()).includes('286'));
          await f.shot('gamepass-guide'); await noOverflow(f.page);
          await f.page.locator('input[type=url]').fill('https://www.roblox.com/game-pass/123456789');
          await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
        }
        await f.page.locator('input[name=payment]').waitFor();
        await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
        await f.page.getByRole('button', { name: 'Confirm & create order', exact: true }).waitFor();
        await f.shot(`${method.toLowerCase()}-confirm`); await noOverflow(f.page);
        assert.equal(await f.page.locator('input[type=password]').count(), 0); await f.clean();
      } finally { await f.context.close(); }
    });
    for (const mode of ['empty', 'null', 'no-products']) await test(`${viewport.width} ${mode} safe unavailable state`, async () => {
      const f = await fixture(viewport, { mode }); try {
        await f.goto(mode === 'no-products' ? '/roblox' : '/roblox/qa-roblox?method=LOGIN');
        await f.page.waitForTimeout(400);
        if (mode === 'no-products') assert.equal(await f.page.locator('article').count(), 3);
        else { await f.page.getByText('No packages are available for this method yet.').waitFor(); assert.equal(await f.page.locator('aside').count(), 0); }
        assert.equal(await f.page.locator('button[type=submit]').count(), 0);
        await noOverflow(f.page); await f.shot(mode); await f.clean();
      } finally { await f.context.close(); }
    });
  }
  for (const region of ['ID', 'MY', 'PH']) for (const method of ['LOGIN', 'GAMEPASS', 'GIFT_USERNAME']) await test(`${region} ${method} independent regional prices and provider gate`, async () => {
    const f = await fixture(viewports[0], { region }); try {
      await f.goto(`/roblox/qa-roblox?method=${method}`);
      const v = f.state.catalog.data[0].variants.find(v => v.method === method);
      if (method === 'LOGIN') {
        await f.page.locator('label').filter({ has: f.page.locator('input[name=package]') }).first().click();
        assert.ok((await f.page.locator('main').innerText()).includes(money(v.price, region)));
        if (region !== 'ID') assert.equal(await f.page.getByRole('button',{name:'Continue',exact:true}).isDisabled(),true);
      } else {
        await f.page.locator('ol').waitFor();
        assert.ok((await f.page.locator('form').innerText()).includes(money(v.price, region)));
      }
      assert.equal(await f.page.locator('select[name=region]').count(), 0);
      if (region !== 'ID') assert.equal(f.state.quoteCalls.length, 0);
      await noOverflow(f.page); await f.shot(`${region.toLowerCase()}-${method.toLowerCase()}`); await f.clean();
    } finally { await f.context.close(); }
  });
  for (const language of ['ID', 'EN', 'MY']) await test(`${language} Login translations and labelled controls`, async () => {
    const f = await fixture(viewports[0], { language }); try {
      await f.goto('/roblox/qa-roblox?method=LOGIN'); await f.page.locator('label').filter({ has: f.page.locator('input[name=package]') }).first().click();
      const expected = { ID: 'Pilih nominal Robux', EN: 'Choose Robux amount', MY: 'Pilih jumlah Robux' }[language];
      assert.ok((await f.page.locator('main').innerText()).includes(expected));
      const radio = f.page.locator('input[name=package]').first(); await radio.focus();
      assert.ok(await radio.evaluate(el => parseFloat(getComputedStyle(el.parentElement).outlineWidth) >= 2), 'No visible keyboard focus');
      await f.page.getByRole('button', { name: {ID:'Lanjut',EN:'Continue',MY:'Teruskan'}[language], exact:true }).click();
      await f.page.locator('input[type=email]').waitFor();
      const missing = await f.page.locator('main input, main select').evaluateAll(elements => elements.filter(el => !el.labels?.length && !el.getAttribute('aria-label')).map(el => el.name || el.type));
      assert.deepEqual(missing, [], 'Missing accessible labels');
      await f.shot(`login-${language.toLowerCase()}`); await noOverflow(f.page); await f.clean();
    } finally { await f.context.close(); }
  });
  for (const query of ['', '?method=INVALID', '?method=LOGIN&method=GAMEPASS']) await test(`Invalid or missing method ${query || '(missing)'}`, async () => {
    const f = await fixture(viewports[0]); try {
      await f.goto('/roblox/qa-roblox' + query);
      await f.page.getByText('Choose a Roblox method from the catalog first.').waitFor();
      assert.equal(await f.page.locator('form,ol,input[name=package]').count(), 0);
      await f.clean();
    } finally { await f.context.close(); }
  });
  await test('Unverified region blocks purchase despite region query', async () => {
    const f = await fixture(viewports[0], { region: null }); try {
      await f.goto('/roblox/qa-roblox?method=LOGIN&region=ID');
      await f.page.getByRole('heading',{name:'Choose Robux amount',exact:true}).waitFor();
      assert.equal(await f.page.locator('form').count(), 0);
      assert.equal(await f.page.locator('input[name=package]:enabled').count(), 0);
      assert.equal(f.state.quoteCalls.length, 0); await f.shot('region-unverified'); await f.clean();
    } finally { await f.context.close(); }
  });
  await test('Login quote failure, retry and invalid form never submit', async () => {
    const f = await fixture(viewports[0]); try {
      f.state.quoteFailure = true;
      await f.goto('/roblox/qa-roblox?method=LOGIN'); await f.page.locator('label').filter({ has: f.page.locator('input[name=package]') }).first().click();
      await f.page.getByRole('button',{name:'Continue',exact:true}).click();
      await f.page.locator('input[name=username]').waitFor();
      await f.page.getByRole('button',{name:'Continue',exact:true}).click();
      assert.equal(await f.page.locator('form [role=alert]').count(),3);
      await f.page.locator('input[name=username]').fill('FixtureUser');
      await f.page.locator('select[name=phoneCountry]').selectOption('US');
      await f.page.locator('input[name=whatsapp]').fill('2133734253');
      await f.page.locator('input[name=email]').fill('fixture@example.invalid');
      await f.page.getByRole('button',{name:'Continue',exact:true}).click();
      await f.page.waitForURL('**/login/summary');
      await f.page.getByRole('alert').filter({has: f.page.getByRole('button',{name:'Try again',exact:true})}).waitFor();
      assert.equal(await f.page.getByRole('button',{name:'Confirm order',exact:true}).isDisabled(),true);
      f.state.quoteFailure = false;
      await f.page.getByRole('button',{name:'Try again',exact:true}).click();
      await f.page.waitForFunction(() => [...document.querySelectorAll('button')].some(b=>b.textContent==='Confirm order'&&!b.disabled));
      await f.clean();
    } finally { await f.context.close(); }
  });
  await test('Username lookup distinguishes missing from unavailable', async () => {
    const f = await fixture(viewports[0]); try {
      await f.goto('/roblox/qa-roblox?method=GIFT_USERNAME'); await f.page.getByRole('button', { name: 'Continue', exact: true }).click();
      await f.page.locator('input[name=username]').fill('FixtureUser');
      f.state.lookup = 'missing'; await f.page.getByRole('button', { name: 'Check username', exact: true }).click();
      await f.page.getByText('Username not found. Use your username, not your display name.').waitFor();
      assert.equal(await f.page.locator('input[name=username]').evaluate(el => el.validity.customError), true);
      f.state.lookup = 'unavailable'; await f.page.getByRole('button', { name: 'Check username', exact: true }).click();
      await f.page.getByText(/Roblox cannot be reached right now/).waitFor();
      assert.equal(await f.page.locator('input[name=username]').evaluate(el => el.validity.customError), false);
      await f.clean();
    } finally { await f.context.close(); }
  });
  await test('Apps Premium storefront and Game disabled checkout smoke', async () => {
    const f = await fixture(viewports[0]); try {
      await f.goto('/apps'); await f.page.getByText('QA Apps Premium', { exact: true }).waitFor();
      await f.shot('apps');
      await f.goto('/games'); await f.page.getByText('QA Game', { exact: true }).click();
      await f.page.waitForURL('**/games/qa-game'); await f.page.locator('label').filter({ has: f.page.locator('input[name=package]') }).click();
      await f.page.locator('input[name=zoneId]').waitFor();
      assert.equal(await f.page.locator('button[type=submit],form > aside button').last().isDisabled(), true);
      assert.equal(await f.page.locator('input[name=username]').count(), 0);
      await f.shot('game-disabled'); await noOverflow(f.page); await f.clean();
    } finally { await f.context.close(); }
  });
} finally {
  await browser.close();
  await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length }));
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
}
