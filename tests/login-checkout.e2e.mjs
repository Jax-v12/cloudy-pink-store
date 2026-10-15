// All checkout/order responses are synthetic; APIs and external traffic never reach a provider/DB.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:3136';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const reproduce = process.argv.includes('--reproduce');
const filter = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const results = [];
async function run(name, fn) {
  if (filter && !name.includes(filter)) return;
  try { await fn(); results.push('PASS'); console.log('PASS ' + name); }
  catch (error) {
    results.push('FAIL'); console.log('FAIL ' + name + ' (' + error.name + ')');
    for (const frame of (error.stack || '').split('\n').filter(line => line.startsWith('    at ')).slice(0, 2)) console.log(frame);
  } // Never dump request/token/contact assertions.
}
async function fixture(mode = 'success') {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('store_lang', 'EN'));
  const state = { requests: [], orders: new Map(), price: 7500, token: 'a'.repeat(64), delayed: false, denied: 0, errors: 0 };
  const success = { success: true, data: { invoice: 'INV-FIXTURE', accessToken: 'synthetic-invoice-access' } };
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) { state.denied++; return route.abort(); }
    if (url.pathname.startsWith('/order/')) {
      state.delayed = true; await new Promise(resolve => setTimeout(resolve, 1200)); return route.continue();
    }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/products') return route.fulfill({ json: { success: true,
      data: [{ id: 9001, slug: 'qa-login', name: 'Fixture', type: 'ROBLOX', checkoutEnabled: true,
        variants: [{ id: 1, name: 'Fixture 100', units: 100, price: state.price, method: 'LOGIN' }] }],
      location: { region: 'ID' }, paymentMethods: [{ id: 'QRIS', label: 'QRIS' }], pagination: { nextCursor: null } } });
    if (url.pathname === '/api/checkout/quote') return route.fulfill({ json: { success: true, data: {
      productSubtotal: state.price, paymentFee: 750, discount: 0, totalAmount: state.price + 750,
      pricingRegion: 'ID', quoteToken: state.token } } });
    if (url.pathname === '/api/checkout') {
      const payload = req.postData(), key = req.headers()['idempotency-key'];
      state.requests.push({ payload, key }); const count = state.requests.length;
      if (mode === 'pending' || (mode === 'no-commit' && count === 1)) return route.fulfill({ status: 503, json: { success: false, errorCode: 'SYSTEM_ERROR' } });
      if (mode === 'rate-limited' && count === 2) return route.fulfill({ status: 429, json: { success: false, errorCode: 'RATE_LIMIT_EXCEEDED' } });
      // Mimic the real backend: replay BEFORE pricing validation; key+body must match.
      if (state.orders.has(key)) {
        if (state.orders.get(key) !== payload) return route.fulfill({ status: 409, json: { success: false, errorCode: 'IDEMPOTENCY_CONFLICT' } });
        return route.fulfill({ json: success });
      }
      if (JSON.parse(payload).quoteToken !== state.token) return route.fulfill({ status: 409, json: { success: false, errorCode: 'PRICE_CHANGED' } });
      state.orders.set(key, payload);
      if (mode !== 'success' && mode !== 'no-commit' && count === 1) {
        if (mode === 'network') return route.abort('failed');
        if (mode === 'malformed') return route.fulfill({ json: { success: true, data: { invoice: 'INV-FIXTURE' } } });
        return route.fulfill({ status: 503, json: { success: false, errorCode: 'SYSTEM_ERROR' } });
      }
      return route.fulfill({ json: success });
    }
    if (url.pathname === '/api/orders/INV-FIXTURE') return route.fulfill({ json: { success: true, data: {
      invoice: 'INV-FIXTURE', type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'COMPLETED', refundStatus: 'NONE',
      units: 100, variantName: 'Fixture 100', robloxDetail: { method: 'LOGIN', username: 'FixtureUser', gamepassPrice: null },
      gameDetail: null, currency: 'IDR', pricingRegion: 'ID', productSubtotal: 7500, paymentFee: 750, discount: 0,
      totalAmount: 8250, paymentMethod: 'QRIS', qrisUrl: null, qrisCode: null, account: null, product: { name: 'Fixture' }, isAuthorized: true } } });
    state.denied++; return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', () => state.errors++);
  const confirm = () => page.getByRole('button', { name: 'Confirm order', exact: true });
  const recover = () => page.getByRole('button', { name: 'Recover previous request', exact: true });
  async function ready() { await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Confirm order' && !b.disabled)); }
  async function summary() {
    await page.goto(base + '/roblox/qa-login?method=LOGIN');
    await page.locator('input[name=package]').first().check({ force: true });
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.waitForURL('**/login/account');
    await page.locator('[name=username]').fill('FixtureUser'); await page.locator('[name=phoneCountry]').selectOption('US');
    await page.locator('[name=whatsapp]').fill('2133734253'); await page.locator('[name=email]').fill('fixture@example.invalid');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.waitForURL('**/login/summary'); await ready();
  }
  async function changeQuote() {
    state.price = 8400; state.token = 'b'.repeat(64);
    await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.waitForURL('**/login/account');
    await page.getByRole('button', { name: 'Continue', exact: true }).click(); await page.waitForURL('**/login/summary');
  }
  async function replay() { await recover().click(); }
  async function invoice() { await page.waitForURL('**/order/INV-FIXTURE'); assert.equal(state.orders.size, 1); }
  async function close() { try { assert.equal(state.denied, 0); assert.equal(state.errors, 0); } finally { await context.close(); } }
  return { context, page, state, confirm, recover, ready, summary, changeQuote, replay, invoice, close };
}
try {
  await run('successful checkout survives delayed invoice navigation and double-submit', async () => {
    const f = await fixture(); try {
      await f.summary(); await f.confirm().evaluate(button => { button.click(); button.click(); });
      await f.invoice(); assert.equal(f.state.delayed, true); assert.equal(f.state.requests.length, 1);
    } finally { await f.close(); }
  });
  await run('ambiguous commit replays original key/body after quote changes', async () => {
    const f = await fixture('commit'); try {
      await f.summary(); await f.confirm().click(); await f.page.locator('main [role=alert]').waitFor();
      await f.changeQuote();
      if (reproduce) { await f.ready(); await f.confirm().click(); } else await f.replay();
      await f.invoice(); assert.equal(f.state.requests.length, 2); assert.deepEqual(f.state.requests[0], f.state.requests[1]);
    } finally { await f.close(); }
  });
  if (!reproduce) {
    await run('empty draft direct entry and refresh never submit checkout', async () => {
      const f = await fixture(); try {
        for (const stage of ['account', 'summary']) { await f.page.goto(base + '/roblox/qa-login/login/' + stage); await f.page.waitForURL('**?method=LOGIN'); }
        await f.summary(); await f.page.reload(); await f.page.waitForURL('**?method=LOGIN'); assert.equal(f.state.requests.length, 0);
      } finally { await f.close(); }
    });
    for (const mode of ['commit', 'network', 'malformed', 'rate-limited']) await run(mode + ' response recovers one logical order with original identity', async () => {
      const f = await fixture(mode); try {
        await f.summary(); await f.confirm().click(); await f.recover().waitFor();
        assert.equal(await f.confirm().isDisabled(), true);
        await f.recover().evaluate(button => { button.click(); button.click(); });
        if (mode === 'rate-limited') { await f.recover().waitFor(); assert.equal(await f.confirm().isDisabled(), true); await f.replay(); }
        await f.invoice(); assert.equal(f.state.requests.length, mode === 'rate-limited' ? 3 : 2);
        for (const req of f.state.requests) assert.deepEqual(req, f.state.requests[0]);
      } finally { await f.close(); }
    });
    await run('unresolved recovery cannot submit new contact/quote or a second order', async () => {
      const f = await fixture('pending'); try {
        await f.summary(); await f.confirm().click(); await f.recover().waitFor(); await f.changeQuote();
        await f.page.getByRole('button', { name: 'Back', exact: true }).click(); await f.page.locator('[name=email]').fill('changed@example.invalid');
        await f.page.getByRole('button', { name: 'Continue', exact: true }).click(); await f.page.waitForURL('**/login/summary');
        await f.replay(); await f.recover().waitFor(); assert.equal(await f.confirm().isDisabled(), true);
        assert.equal(f.state.orders.size, 0); assert.equal(f.state.requests.length, 2); assert.deepEqual(f.state.requests[0], f.state.requests[1]);
      } finally { await f.close(); }
    });
    await run('original committed request recovers even when current package price is unavailable', async () => {
      const f = await fixture('commit'); try {
        await f.summary(); await f.confirm().click(); await f.recover().waitFor();
        await f.changeQuote(); await f.confirm().waitFor(); f.state.price = null;
        await f.page.getByRole('button', { name: 'Back', exact: true }).click(); await f.page.waitForURL('**/login/account');
        await f.page.goBack(); await f.page.waitForURL('**/login/summary');
        await f.page.getByText('Pricing is not available for this region yet.', { exact: true }).waitFor();
        await f.replay(); await f.invoice(); assert.equal(f.state.requests.length, 2); assert.deepEqual(f.state.requests[0], f.state.requests[1]);
      } finally { await f.close(); }
    });
    await run('absent commit and stale quote require explicit confirmation of fresh quote', async () => {
      const f = await fixture('no-commit'); try {
        await f.summary(); await f.confirm().click(); await f.recover().waitFor(); await f.changeQuote(); await f.replay(); await f.ready();
        assert.equal(f.state.requests.length, 2); assert.equal(f.state.orders.size, 0); assert.deepEqual(f.state.requests[0], f.state.requests[1]);
        await f.confirm().click(); await f.invoice(); assert.equal(f.state.requests.length, 3);
        assert.notEqual(f.state.requests[2].key, f.state.requests[0].key); assert.notEqual(f.state.requests[2].payload, f.state.requests[0].payload);
      } finally { await f.close(); }
    });
    await run('absent commit with unchanged quote retries only the originally confirmed intent', async () => {
      const f = await fixture('no-commit'); try {
        await f.summary(); await f.confirm().click(); await f.recover().waitFor(); assert.equal(f.state.orders.size, 0);
        await f.replay(); await f.invoice(); assert.equal(f.state.requests.length, 2); assert.deepEqual(f.state.requests[0], f.state.requests[1]);
      } finally { await f.close(); }
    });
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ PASS: results.filter(r => r === 'PASS').length, FAIL: results.filter(r => r === 'FAIL').length, SKIP: 0 }));
if (results.includes('FAIL')) process.exitCode = 1;
