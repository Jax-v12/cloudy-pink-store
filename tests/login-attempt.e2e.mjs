// Actual browser/IndexedDB/UI, isolated API/provider fixtures. No database/payment.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loginCredentialsFixture } from './login-access-fixture.mjs';
import { fulfillFixtureRead } from './browser-fixture-transport.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = 'https://store.invalid', server = 'http://127.0.0.1:3144';
const output = path.resolve('.cache/login-qa/attempt-flow'); await fs.mkdir(output, { recursive: true });
const results = [], filter = process.argv.find(value => value.startsWith('--case='))?.slice(7);
async function run(name, fn) {
  if (filter && !name.includes(filter)) return;
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'FAIL', type: error.name }); console.log('FAIL ' + name + ' (' + error.name + ')');
    for (const line of (error.stack ?? '').split('\n').filter(value => value.startsWith('    at ')).slice(0, 2)) console.log(line); }
}
const cookieName = '__Host-cloudy_checkout';
const viewports = [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }];
async function fixture({ viewport = viewports[0], mode = 'normal', region = 'ID', locale = 'EN', storage = '', payment = true, nullPrice = false } = {}) {
  const sessions = new Map(), attempts = new Map();
  const state = { sessions, attempts, orders: 0, confirmations: 0, recoveries: 0, issuers: 0, legacy: 0, network: 0, errors: 0, price: { ID: 7500, MY: 2100, PH: 12300 }[region], token: 'a'.repeat(64), delay: false, late: false, forceReady: false, bootstrapLocators: [] };
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(({ locale, storage }) => {
    localStorage.setItem('store_lang', locale);
    // Explicitly test the no-Web-Locks path; IndexedDB + the server remain authoritative.
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    if (storage === 'absent') Object.defineProperty(globalThis, 'indexedDB', { value: undefined });
    if (storage === 'throws') IDBFactory.prototype.open = () => { throw new DOMException('fixture', 'SecurityError'); };
    if (storage === 'timeout' || storage === 'blocked') IDBFactory.prototype.open = () => {
      const request = {}; if (storage === 'blocked') setTimeout(() => request.onblocked?.(), 0); return request;
    };
    if (storage === 'abort') {
      const get = IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.get = function (...args) { const req = get.apply(this, args); const tx = this.transaction; req.addEventListener('success', () => tx.abort()); return req; };
    }
  }, { locale, storage });
  const json = (route, data, status = 200, headers = {}) => route.fulfill({ status, json: data, headers: { 'cache-control': 'private, no-store', ...headers } });
  const dto = row => ({ flowId: row.flowId, productId: 9001, variantId: row.variantId, version: row.version, outcome: row.outcome,
    selectionLocked: row.locked, expiresAt: new Date(Date.now() + 1800000).toISOString(), ...(row.invoice ? { invoice: row.invoice } : {}) });
  const fail = (route, errorCode, status) => json(route, { success: false, errorCode }, status);
  const dispatch = async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) { state.network++; return route.abort(); }
    if (url.pathname.startsWith('/order/') && mode === 'delay-invoice' && !req.headers()['rsc']) { state.delay = true; await new Promise(resolve => setTimeout(resolve, 1000)); }
    if (!url.pathname.startsWith('/api/')) return fulfillFixtureRead(route, server);
    if (url.pathname === '/api/roblox/user') return json(route, { success: true, data: { id: 42, name: 'FixtureUser', displayName: 'Fixture Public Name', avatarUrl: null } });
    const headers = await req.allHeaders();
    const credential = (headers.cookie ?? '').split(';').map(value => value.trim()).find(value => value.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    const owner = [...sessions.entries()].find(([, value]) => value === credential)?.[0];
    if (url.pathname === '/api/products') return json(route, { success: true, data: url.searchParams.get('type') === 'ROBLOX' ? [{ id: 9001, slug: 'qa-login', name: 'Fixture Roblox', type: 'ROBLOX', checkoutEnabled: payment, variants: [
      { id: 1, name: 'Fixture 100', units: 100, method: 'LOGIN', price: nullPrice ? null : state.price },
      { id: 2, name: 'Fixture 200', units: 200, method: 'LOGIN', price: nullPrice ? null : state.price * 2 },
      ...['GAMEPASS', 'GIFT_USERNAME'].map((method, i) => ({ id: 3 + i, name: method, units: 50, maxUnits: 5000, unitStep: 5, method, price: state.price })),
    ] }] : [], location: { region }, paymentMethods: payment ? [{ id: 'QRIS', label: 'QRIS' }] : [], pagination: { nextCursor: null } });
    if (url.pathname === '/api/checkout/quote') return json(route, { success: true, data: { productSubtotal: state.price, paymentFee: 0, discount: 0, totalAmount: state.price,
      pricingRegion: region, quoteToken: state.token } });
    if (url.pathname === '/api/checkout') { state.legacy++; return fail(route, 'CHECKOUT_SESSION_REQUIRED', 401); }
    if (url.pathname === '/api/checkout/session') {
      const { locator } = req.postDataJSON(); state.bootstrapLocators.push(locator);
      if (credential) return owner === locator ? json(route, { success: true, data: { outcome: 'READY' } }) : fail(route, 'CHECKOUT_SESSION_REQUIRED', 401);
      if (sessions.has(locator)) return fail(route, 'CHECKOUT_BOOTSTRAP_PENDING', 409);
      const issued = crypto.randomBytes(32).toString('base64url'); sessions.set(locator, issued); state.issuers++;
      if (mode === 'bootstrap-lost') return route.abort('failed');
      if (mode === 'bootstrap-delayed') await new Promise(resolve => setTimeout(resolve, 900));
      return json(route, { success: true, data: { outcome: 'COOKIE_ISSUED' } }, 201, { 'set-cookie': `${cookieName}=${issued}; HttpOnly; Secure; SameSite=Lax; Path=/` });
    }
    if (url.pathname.startsWith('/api/checkout/attempts')) {
      if (!owner) return fail(route, 'CHECKOUT_SESSION_REQUIRED', 401);
      if (url.pathname === '/api/checkout/attempts') {
        const body = req.postDataJSON(); let row = attempts.get(body.flowId);
        if (row && row.owner !== owner) row = null;
        if (!row) {
          const prior = [...attempts.values()].filter(row => row.owner === owner).at(-1);
          if (prior && (['NOT_COMMITTED', 'UNKNOWN'].includes(prior.outcome) || body.previousFlowId !== prior.flowId)) row = prior;
        }
        if (!row) { row = { owner, flowId: body.flowId, variantId: body.variantId, version: 0, locked: false, outcome: 'NOT_COMMITTED' }; attempts.set(row.flowId, row); }
        else if (!row.locked && row.outcome === 'NOT_COMMITTED' && row.variantId !== body.variantId) { row.variantId = body.variantId; row.version++; }
        return json(route, { success: true, data: dto(row) });
      }
      const row = attempts.get(url.pathname.split('/')[4]);
      if (!row || row.owner !== owner) return fail(route, 'ATTEMPT_NOT_FOUND', 404);
      if (url.pathname.endsWith('/recover')) {
        state.recoveries++;
        if (state.late && row.outcome === 'UNKNOWN') { row.outcome = 'COMMITTED'; row.invoice = `INV-FIXTURE-${++state.orders}`; }
        if (state.forceReady && row.outcome === 'UNKNOWN') { row.outcome = 'NOT_COMMITTED'; row.version++; }
        return json(route, { success: true, data: dto(row) });
      }
      if (url.pathname.endsWith('/confirm')) {
        state.confirmations++; const body = req.postDataJSON();
        if (row.outcome === 'COMMITTED') return json(route, { success: true, data: { flowId: row.flowId, outcome: row.outcome, invoice: row.invoice } });
        if (row.outcome !== 'NOT_COMMITTED' || body.version !== row.version) return fail(route, 'CHECKOUT_UNKNOWN', 503);
        row.locked = true; row.version++;
        assert.equal(body.reconfirm, true); assert.equal(body.checkout.quoteToken, state.token); assert.equal('pricingRegion' in body.checkout, false);
        assert.equal(body.checkout.details.whatsappE164, '+12133734253');
        assert.equal(body.checkout.details.password, loginCredentialsFixture().password);
        assert.deepEqual(body.checkout.details.backupCodes, loginCredentialsFixture().backupCodes);
        if ((mode === 'unknown' || mode === 'requote') && state.confirmations === 1) { row.outcome = 'UNKNOWN'; return fail(route, 'CHECKOUT_UNKNOWN', 503); }
        row.outcome = 'COMMITTED'; row.invoice = `INV-FIXTURE-${++state.orders}`;
        if (mode === 'lost' && state.confirmations === 1) return route.abort('failed');
        return json(route, { success: true, data: { flowId: row.flowId, outcome: row.outcome, invoice: row.invoice } });
      }
    }
    if (url.pathname.startsWith('/api/orders/')) {
      const invoice = url.pathname.split('/')[3]; const owned = [...attempts.values()].find(row => row.invoice === invoice && row.owner === owner);
      if (!owned) return fail(route, 'ORDER_NOT_FOUND', 404);
      assert.equal('x-order-token' in headers, false);
      return json(route, { success: true, data: { invoice, type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'COMPLETED', refundStatus: 'NONE', units: 100, variantName: 'Fixture 100',
        robloxDetail: { method: 'LOGIN', username: 'FixtureUser', gamepassPrice: null }, gameDetail: null, currency: { ID: 'IDR', MY: 'MYR', PH: 'PHP' }[region], pricingRegion: region,
        productSubtotal: state.price, paymentFee: 0, discount: 0, totalAmount: state.price, paymentMethod: 'QRIS', qrisUrl: null, qrisCode: null, account: null, product: { name: 'Fixture' }, isAuthorized: true } });
    }
    state.network++; return route.abort();
  };
  const handler = async route => { try { await dispatch(route); } catch { if (!state.closing) state.errors++; } };
  await context.route('**/*', handler);
  async function page() { const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', () => state.errors++); return page; }
  const picker = base + '/roblox/qa-login?method=LOGIN';
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  async function start(page) { await page.goto(picker); await page.locator('input[value="1"]').waitFor({ state: 'attached' }); }
  async function account(page) { await start(page); await page.locator('input[value="1"]').check({ force: true }); await button(page, 'Continue').click(); await page.waitForURL('**/login/account'); }
  async function fillSecrets(page) { const access = loginCredentialsFixture(); await page.locator('[name=robloxPassword]').fill(access.password); for (const [index, code] of access.backupCodes.entries()) await page.locator(`[name=backupCode${index + 1}]`).fill(code); }
  async function fill(page) { await page.locator('[name=username]').fill('FixtureUser'); await page.locator('[name=phoneCountry]').selectOption('US'); await page.locator('[name=whatsapp]').fill('2133734253'); await page.locator('[name=email]').fill('fixture@example.invalid'); await fillSecrets(page); }
  async function ready(page) { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(value => value.textContent === 'Confirm order' && !value.disabled)); }
  async function summary(page) { await account(page); await fill(page); await button(page, 'Continue').click(); await page.waitForURL('**/login/summary'); await ready(page); }
  async function clean(page) {
    const values = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const request = indexedDB.open('cloudy-checkout', 1); request.onsuccess = () => resolve(request.result); request.onerror = reject; });
      const locator = await new Promise((resolve, reject) => { const tx = db.transaction('coordination'); const req = tx.objectStore('coordination').getAll(); req.onsuccess = () => resolve(req.result); req.onerror = reject; }); db.close();
      return JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, indexed: locator, visibleCookie: document.cookie });
    });
    for (const denied of ['FixtureUser', 'fixture@example.invalid', '+12133734253', '081234567890', '+6281234567890', loginCredentialsFixture().password, ...loginCredentialsFixture().backupCodes, 'quoteToken', 'checkoutKey', 'accessToken', ...sessions.values()]) assert.equal(values.includes(denied), false);
    assert.equal(state.errors, 0); assert.equal(state.network, 0); assert.equal(state.legacy, 0);
  }
  async function close() { const errors = state.errors; state.closing = true; await context.close(); assert.equal(errors, 0); }
  return { context, close, handler, state, page, picker, start, account, fill, fillSecrets, ready, summary, button, clean };
}
try {
  await run('Indonesia default and public username lookup states', async () => {
    const f = await fixture(); const p = await f.page();
    try {
      await f.account(p);
      assert.equal(await p.locator('[name=phoneCountry]').inputValue(), 'ID');
      assert.equal(await p.locator('[data-phone-flag]').getAttribute('src'), '/flags/id.svg');
      let mode = 'success', release;
      await f.context.route('https://avatar.rbxcdn.com/synthetic-avatar.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64') }));
      await f.context.route('**/api/roblox/user?**', async route => {
        if (mode === 'network') return route.abort();
        if (mode === 'slow') await new Promise(resolve => { release = resolve; });
        if (mode === 'missing') return route.fulfill({ status: 404, json: { success: false, errorCode: 'ROBLOX_USER_NOT_FOUND' } });
        if (mode === 'rate') return route.fulfill({ status: 429, json: { success: false, errorCode: 'RATE_LIMIT_EXCEEDED' } });
        if (mode === 'failure') return route.fulfill({ status: 503, json: { success: false, errorCode: 'LOOKUP_UNAVAILABLE' } });
        return route.fulfill({ json: { success: true, data: { id: 42, name: 'FixtureUser', displayName: 'Fixture Display', avatarUrl: 'https://avatar.rbxcdn.com/synthetic-avatar.png' } } });
      });
      const check = () => f.button(p, 'Check Roblox username').click();
      const status = p.locator('#login-username-lookup');
      await p.locator('[name=username]').fill('FixtureUser'); await check(); await status.getByText('Fixture Display').waitFor();
      assert.ok((await status.innerText()).includes('@FixtureUser')); assert.ok((await status.innerText()).includes('42'));
      assert.equal(await status.locator('img').getAttribute('src'), 'https://avatar.rbxcdn.com/synthetic-avatar.png');
      await status.locator('img').evaluate(image => image.decode());
      await p.locator('[name=username]').fill('ChangedUser'); assert.equal(await status.getByText('Fixture Display').count(), 0);
      for (const [next, message] of [['missing', 'Username was not found.'], ['rate', 'Too many checks. Please try again later.'], ['failure', 'Username check is temporarily unavailable. Try again.'], ['network', 'Username check is temporarily unavailable. Try again.']]) {
        mode = next; await check(); await status.getByText(message, { exact: true }).waitFor();
      }
      mode = 'slow'; await check(); await status.getByText('Checking username…').waitFor();
      await p.locator('[name=username]').fill('OtherUser');
      release(); await p.waitForTimeout(100); assert.equal(await status.getByText('Fixture Display').count(), 0);
      await p.clock.install(); mode = 'slow'; await check(); await p.waitForTimeout(50); await p.clock.fastForward(10_001);
      await status.getByText('Username check timed out. Try again.', { exact: true }).waitFor(); release();
      assert.equal(f.state.orders, 0); assert.equal(f.state.confirmations, 0);
    } finally { await f.close(); }
  });
  for (const viewport of viewports) for (const locale of ['ID', 'EN', 'MY']) await run(`${viewport.width} ${locale} ASEAN phone flags and international compatibility`, async () => {
    const f = await fixture({ viewport, locale }); const p = await f.page(); try {
      await f.start(p); await p.locator('input[value="1"]').check({ force: true });
      await f.button(p, { ID: 'Lanjut', EN: 'Continue', MY: 'Teruskan' }[locale]).click(); await p.waitForURL('**/login/account');
      const select = p.locator('[name=phoneCountry]');
      assert.equal(await select.inputValue(), 'ID');
      const asean = ['ID', 'MY', 'PH', 'SG', 'TH', 'VN', 'BN', 'KH', 'LA', 'MM', 'TL'];
      assert.deepEqual(await select.locator('optgroup').first().locator('option').evaluateAll(options => options.map(option => option.value)), asean);
      assert.equal(await select.locator('optgroup').first().getAttribute('label'), { ID: 'Negara ASEAN', EN: 'ASEAN countries', MY: 'Negara ASEAN' }[locale]);
      const countries = await select.locator('option').evaluateAll(options => options.map(option => option.value).filter(Boolean));
      assert.ok(countries.length > 200); assert.equal(new Set(countries).size, countries.length);
      for (const country of asean) {
        await select.selectOption(country);
        const flag = p.locator('[data-phone-flag]');
        assert.equal(await flag.getAttribute('src'), `/flags/${country.toLowerCase()}.svg`);
        await flag.evaluate(image => image.decode());
      }
      await select.selectOption('ID'); await select.focus(); await p.keyboard.press('ArrowDown'); assert.equal(await select.inputValue(), 'MY');
      assert.equal(await select.evaluate(element => element === document.activeElement), true);
      await select.selectOption('US'); assert.equal(await p.locator('[data-phone-flag]').count(), 0);
      await select.selectOption('ID'); await p.locator('[name=username]').fill('FixtureUser');
      const lookupButton = f.button(p, { ID: 'Cek Nama pengguna Roblox', EN: 'Check Roblox username', MY: 'Semak nama pengguna Roblox' }[locale]);
      await lookupButton.focus(); await p.keyboard.press('Enter');
      await p.locator('#login-username-lookup').getByText('Fixture Public Name', { exact: true }).waitFor();
      assert.ok((await p.locator('#login-username-lookup').innerText()).includes('42'));
      const guide = p.locator('details');
      await guide.locator('summary').focus(); await p.keyboard.press('Enter');
      await p.waitForFunction(() => document.querySelector('details')?.open);
      assert.equal(await guide.locator('li').count(), 3);
      await p.keyboard.press('Space');
      await p.waitForFunction(() => !document.querySelector('details')?.open);
      await p.locator('[name=whatsapp]').fill('081234567890'); await p.locator('[name=email]').fill('fixture@example.invalid');
      await f.fillSecrets(p);
      assert.equal(f.state.orders, 0); assert.equal(f.state.confirmations, 0);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(image => image.decode())); });
      await p.screenshot({ path: path.join(output, `${viewport.width}-${locale}-asean-account.png`), fullPage: true });
      await f.button(p, { ID: 'Lanjut', EN: 'Continue', MY: 'Teruskan' }[locale]).click(); await p.waitForURL('**/login/summary');
      await p.getByText('+6281234567890', { exact: true }).waitFor();
      const summary = await p.locator('main').innerHTML();
      for (const value of [loginCredentialsFixture().password, ...loginCredentialsFixture().backupCodes]) assert.equal(summary.includes(value), false);
      assert.equal(f.state.orders, 0); assert.equal(f.state.confirmations, 0); await f.clean(p);
    } finally { await f.close(); }
  });
  for (const viewport of viewports) await run(`${viewport.width} credentials validate, mask, survive back and clear on reload`, async () => {
    const f = await fixture({ viewport }); const p = await f.page(); try {
      await f.account(p); await f.fill(p);
      assert.equal(await p.locator('input[type=password]').count(), 6);
      await f.button(p, 'Show').click(); assert.equal(await p.locator('[name=robloxPassword]').getAttribute('type'), 'text');
      await f.button(p, 'Hide').click(); assert.equal(await p.locator('[name=robloxPassword]').getAttribute('type'), 'password');
      await p.locator('[name=backupCode5]').fill(loginCredentialsFixture().backupCodes[0]);
      await f.button(p, 'Continue').click(); await p.locator('#login-backup-error').waitFor();
      assert.equal(new URL(p.url()).pathname.endsWith('/login/account'), true); assert.equal(f.state.confirmations, 0);
      await p.locator('[name=backupCode5]').fill(loginCredentialsFixture().backupCodes[4]); await f.button(p, 'Continue').click(); await f.ready(p);
      const html = await p.locator('main').innerHTML(); for (const value of [loginCredentialsFixture().password, ...loginCredentialsFixture().backupCodes]) assert.equal(html.includes(value), false);
      await f.button(p, 'Back').click(); await p.locator('[name=robloxPassword]').waitFor();
      assert.equal(await p.locator('[name=robloxPassword]').inputValue(), loginCredentialsFixture().password);
      assert.equal(await p.locator('[name=backupCode5]').inputValue(), loginCredentialsFixture().backupCodes[4]);
      await f.button(p, 'Continue').click(); await f.ready(p); await f.clean(p);
      await p.reload(); await p.waitForURL('**?method=LOGIN'); await f.button(p, 'Continue').click(); await p.waitForURL('**/login/account');
      assert.equal(await p.locator('[name=robloxPassword]').inputValue(), '');
      for (let index = 1; index <= 5; index++) assert.equal(await p.locator(`[name=backupCode${index}]`).inputValue(), '');
      assert.equal(f.state.orders, 0); await f.clean(p);
    } finally { await f.close(); }
  });
  for (const viewport of viewports) await run(`${viewport.width} three pages, validation, back, double submit and delayed invoice`, async () => {
    const f = await fixture({ viewport, mode: 'delay-invoice' }); const p = await f.page(); try {
      await f.account(p); await f.button(p, 'Continue').click(); assert.equal(await p.locator('form [role=alert]').count(), 5);
      await f.fill(p); await f.button(p, 'Continue').click(); await p.waitForURL('**/login/summary'); await f.ready(p);
      assert.equal(f.state.confirmations, 0); await f.button(p, 'Back').click(); await p.locator('[name=email]').waitFor(); assert.equal(await p.locator('[name=email]').inputValue(), 'fixture@example.invalid');
      await f.button(p, 'Continue').click(); await f.ready(p);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await p.screenshot({ path: path.join(output, `${viewport.width}-summary.png`), fullPage: true });
      await f.button(p, 'Confirm order').evaluate(button => { button.click(); button.click(); });
      await p.waitForURL('**/order/INV-FIXTURE-1'); assert.equal(f.state.confirmations, 1); assert.equal(f.state.orders, 1);
      await f.clean(p);
    } finally { await f.close(); }
  });
  await run('committed response lost then refresh recovers same invoice without contact draft', async () => {
    const f = await fixture({ mode: 'lost' }); const p = await f.page(); try {
      await f.summary(p); await f.button(p, 'Confirm order').click(); await p.getByText('The previous request may have created an order.', { exact: false }).waitFor();
      await p.reload(); await p.getByRole('link', { name: 'Open invoice', exact: true }).waitFor();
      assert.equal(f.state.confirmations, 1); assert.equal(f.state.orders, 1); await f.clean(p);
      await p.getByRole('link', { name: 'Open invoice', exact: true }).click(); await p.waitForURL('**/order/INV-FIXTURE-1');
    } finally { await f.close(); }
  });
  await run('UNKNOWN late commit blocks new confirmation and recovers without another checkout', async () => {
    const f = await fixture({ mode: 'unknown' }); const p = await f.page(); try {
      await f.summary(p); await f.button(p, 'Confirm order').click(); await f.button(p, 'Recover previous request').waitFor();
      assert.equal(await f.button(p, 'Confirm order').count(), 0); f.state.late = true;
      await f.button(p, 'Recover previous request').click(); await p.getByRole('link', { name: 'Open invoice', exact: true }).waitFor();
      assert.equal(f.state.confirmations, 1); assert.equal(f.state.orders, 1); await f.clean(p);
    } finally { await f.close(); }
  });
  await run('NOT_COMMITTED requotes but requires explicit final click with same flow identity', async () => {
    const f = await fixture({ mode: 'requote' }); const p = await f.page(); try {
      await f.summary(p); await f.button(p, 'Confirm order').click(); await f.button(p, 'Recover previous request').waitFor();
      const original = [...f.state.attempts.keys()][0]; f.state.price = 9000; f.state.token = 'b'.repeat(64); f.state.forceReady = true;
      await f.button(p, 'Recover previous request').click(); await f.ready(p); assert.equal(f.state.confirmations, 1); assert.equal(f.state.orders, 0);
      await f.button(p, 'Confirm order').click(); await p.waitForURL('**/order/INV-FIXTURE-1');
      assert.equal([...f.state.attempts.keys()][0], original); assert.equal(f.state.attempts.size, 1); await f.clean(p);
    } finally { await f.close(); }
  });
  await run('two tabs share atomic IndexedDB bootstrap, one delayed issuer and one purchase', async () => {
    const f = await fixture({ mode: 'bootstrap-delayed' }); const a = await f.page(), b = await f.page(); try {
      await Promise.all([f.account(a), f.account(b)]);
      assert.equal(f.state.issuers, 1); assert.equal(new Set(f.state.bootstrapLocators).size, 1); assert.equal(f.state.attempts.size, 1);
      for (const p of [a, b]) { await f.fill(p); await f.button(p, 'Continue').click(); await f.ready(p); }
      await Promise.all([f.button(a, 'Confirm order').click(), f.button(b, 'Confirm order').click()]);
      await a.waitForURL('**/order/INV-FIXTURE-1'); await b.waitForURL('**/order/INV-FIXTURE-1');
      assert.equal(f.state.orders, 1); await f.clean(a); await f.clean(b);
    } finally { await f.close(); }
  });
  await run('another browser knowing the public flow cannot read its attempt or invoice', async () => {
    const f = await fixture(); const p = await f.page(); const outsider = await browser.newContext({ serviceWorkers: 'block' });
    try {
      await f.summary(p); await f.button(p, 'Confirm order').click(); await p.waitForURL('**/order/INV-FIXTURE-1');
      const flow = [...f.state.attempts.keys()][0];
      await outsider.route('**/*', f.handler); const other = await outsider.newPage();
      await other.goto(f.picker); await other.locator('input[value="1"]').waitFor({ state: 'attached' });
      const statuses = await other.evaluate(async flow => {
        const attempt = await fetch(`/api/checkout/attempts/${flow}/recover`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
        const invoice = await fetch('/api/orders/INV-FIXTURE-1'); return [attempt.status, invoice.status];
      }, flow);
      assert.deepEqual(statuses, [404, 404]); assert.equal(f.state.orders, 1);
    } finally { await outsider.close(); await f.close(); }
  });
  await run('UNKNOWN polling is bounded and never submits another confirmation', async () => {
    const f = await fixture({ mode: 'unknown' }); const p = await f.page(); try {
      await f.summary(p); await p.clock.install(); await f.button(p, 'Confirm order').click(); await f.button(p, 'Recover previous request').waitFor();
      for (const delay of [1000, 2000, 4000, 8000, 16000]) {
        const response = p.waitForResponse(value => value.url().endsWith('/recover'));
        await p.clock.runFor(delay + 100); await response;
        await p.waitForFunction(() => [...document.querySelectorAll('button')].some(value => value.textContent === 'Recover previous request' && !value.disabled));
      }
      const count = f.state.recoveries; await p.clock.runFor(120000);
      assert.equal(count, 5); assert.equal(f.state.recoveries, count); assert.equal(f.state.confirmations, 1); assert.equal(f.state.orders, 0);
    } finally { await f.close(); }
  });
  await run('corrupt IndexedDB locator is not replaced or used to bootstrap', async () => {
    const f = await fixture(); const p = await f.page(); try {
      await p.goto(base + '/apps');
      await p.evaluate(async () => {
        const db = await new Promise((resolve, reject) => { const req = indexedDB.open('cloudy-checkout', 1); req.onupgradeneeded = () => req.result.createObjectStore('coordination'); req.onerror = reject; req.onsuccess = () => resolve(req.result); });
        await new Promise((resolve, reject) => { const tx = db.transaction('coordination', 'readwrite'); tx.objectStore('coordination').put('corrupt', 'bootstrap'); tx.oncomplete = resolve; tx.onerror = reject; }); db.close();
      });
      await p.goto(f.picker); await p.getByText('Checkout is paused because', { exact: false }).waitFor();
      assert.equal(f.state.issuers, 0); assert.equal(f.state.confirmations, 0);
    } finally { await f.close(); }
  });
  for (const mode of ['bootstrap-lost', 'cookie-lost', 'cookie-invalid']) await run(`${mode} fails closed without replacement issuance or order`, async () => {
    const f = await fixture({ mode }); const p = await f.page(); try {
      if (mode !== 'bootstrap-lost') {
        await f.account(p); await f.context.clearCookies();
        if (mode === 'cookie-invalid') await f.context.addCookies([{ name: cookieName, value: 'invalid', url: base, secure: true, httpOnly: true, sameSite: 'Lax' }]);
      }
      await p.goto(f.picker); await p.getByText('Checkout is paused because', { exact: false }).waitFor();
      assert.equal(f.state.issuers, 1); assert.equal(f.state.orders, 0); assert.equal(f.state.confirmations, 0); assert.equal(f.state.legacy, 0);
    } finally { await f.close(); }
  });
  for (const storage of ['absent', 'throws', 'abort', 'blocked', 'timeout']) await run(`IndexedDB ${storage} fails closed before bootstrap`, async () => {
    const f = await fixture({ storage }); const p = await f.page(); try {
      await p.goto(f.picker); await p.getByText('Checkout is paused because', { exact: false }).waitFor();
      assert.equal(f.state.bootstrapLocators.length, 0); assert.equal(f.state.orders, 0); assert.equal(f.state.errors, 0);
    } finally { await f.close(); }
  });
  await run('repeat purchase is explicit and generates a different flow only after Buy again', async () => {
    const f = await fixture(); const p = await f.page(); try {
      await f.summary(p); await f.button(p, 'Confirm order').click(); await p.waitForURL('**/order/INV-FIXTURE-1');
      await p.goto(f.picker); await f.button(p, 'Buy again').waitFor(); assert.equal(f.state.orders, 1);
      await f.button(p, 'Buy again').click(); await p.locator('input[value="1"]').waitFor({ state: 'attached' });
      await f.button(p, 'Continue').click(); await p.waitForURL('**/login/account'); assert.equal(await p.locator('[name=email]').inputValue(), '');
      assert.equal(await p.locator('[name=robloxPassword]').inputValue(), '');
      for (let index = 1; index <= 5; index++) assert.equal(await p.locator(`[name=backupCode${index}]`).inputValue(), '');
      await f.fill(p); await f.button(p, 'Continue').click(); await f.ready(p); await f.button(p, 'Confirm order').click(); await p.waitForURL('**/order/INV-FIXTURE-2');
      assert.equal(f.state.attempts.size, 2); assert.equal(f.state.orders, 2); await f.clean(p);
    } finally { await f.close(); }
  });
  for (const outcome of ['EXPIRED', 'CANCELLED']) await run(`${outcome} does not revive old flow`, async () => {
    const f = await fixture(); const p = await f.page(); try {
      await f.account(p); const old = [...f.state.attempts.values()][0]; old.outcome = outcome;
      await p.reload(); await f.button(p, 'Buy again').waitFor(); await f.button(p, 'Buy again').click();
      await p.locator('input[value="1"]').waitFor({ state: 'attached' }); assert.equal(f.state.attempts.size, 2); assert.equal(old.outcome, outcome); assert.equal(f.state.orders, 0);
    } finally { await f.close(); }
  });
  for (const region of ['ID', 'MY', 'PH']) for (const nullPrice of [false, true]) await run(`${region} ${nullPrice ? 'unavailable' : 'independent quote'} and phone-country isolation`, async () => {
    const f = await fixture({ region, nullPrice }); const p = await f.page(); try {
      if (nullPrice) { await f.start(p); assert.equal(await p.locator('input[value="1"]').isDisabled(), true); assert.equal(await f.button(p, 'Continue').isDisabled(), true); }
      else { await f.summary(p); assert.ok((await p.locator('main').innerText()).includes({ ID: 'IDR', MY: 'MYR', PH: 'PHP' }[region])); }
      assert.equal(f.state.confirmations, 0); await f.clean(p);
    } finally { await f.close(); }
  });
  for (const locale of ['ID', 'MY']) await run(`${locale} translated picker and safe bootstrap`, async () => {
    const f = await fixture({ locale }); const p = await f.page(); try {
      await f.start(p); assert.equal(await p.locator('h1').innerText(), locale === 'ID' ? 'Pilih nominal Robux' : 'Pilih jumlah Robux'); await f.clean(p);
    } finally { await f.close(); }
  });
  await run('Gamepass, Username and Apps preserve navigation without Login bootstrap', async () => {
    const f = await fixture(); const p = await f.page(); try {
      for (const method of ['GAMEPASS', 'GIFT_USERNAME']) {
        await p.goto(base + '/roblox/qa-login?method=' + method); await p.locator('ol button').first().waitFor();
        assert.equal(await p.locator('ol button').count(), method === 'GAMEPASS' ? 5 : 4);
      }
      await p.goto(base + '/apps'); await p.locator('main').waitFor();
      assert.equal(f.state.issuers, 0); assert.equal(f.state.confirmations, 0); assert.equal(f.state.network, 0); assert.equal(f.state.errors, 0);
    } finally { await f.close(); }
  });
} finally { await browser.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
console.log(JSON.stringify({ PASS: results.filter(row => row.status === 'PASS').length, FAIL: results.filter(row => row.status === 'FAIL').length, SKIP: 0 }));
if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
