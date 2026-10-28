// Real admin UI; every API, document and asset request is isolated from live services.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { loginCredentialsFixture } from './login-access-fixture.mjs';
import { fulfillFixtureRead } from './browser-fixture-transport.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const base = 'https://store.invalid', server = 'http://127.0.0.1:3144';
const output = path.resolve('.cache/login-qa/access-admin'); await fs.mkdir(output, { recursive: true });
const results = [];
const filter = process.argv.find(value => value.startsWith('--case='))?.slice(7);
async function run(name, fn) {
  if (filter && !name.includes(filter)) return;
  try { await fn(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'FAIL', type: error.name }); console.log('FAIL ' + name + ' (' + error.name + ')');
    for (const line of (error.stack ?? '').split('\n').filter(value => value.startsWith('    at ')).slice(0, 2)) console.log(line); }
}
const labels = {
  EN: { open: 'Open account access', dialog: 'Login account access', unlock: 'Unlock for up to 60 seconds', admin: 'Your admin password', show: 'Show', close: 'Close' },
  ID: { open: 'Buka akses akun', dialog: 'Akses akun Via Login', unlock: 'Buka maksimal 60 detik', admin: 'Kata sandi admin Anda', show: 'Tampilkan', close: 'Tutup' },
  MY: { open: 'Buka akses akaun', dialog: 'Akses akaun Log Masuk', unlock: 'Buka sehingga 60 saat', admin: 'Kata laluan pentadbir anda', show: 'Tunjukkan', close: 'Tutup' },
};
async function fixture(viewport = { width: 375, height: 812 }, locale = 'EN', mode = 'normal') {
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(locale => localStorage.setItem('store_lang', locale), locale);
  const state = { authenticated: false, reveals: 0, auth: 0, owned: true, unexpected: 0, errors: 0 };
  const row = () => ({ id: 1, invoice: 'INV-SYNTHETIC-LOGIN', type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'PROCESSING', refundStatus: 'NONE',
    totalAmount: 7500, currency: 'IDR', pricingRegion: 'ID', productName: 'Synthetic Login', variantName: 'Fixture 100', units: 100, owned: state.owned,
    contactEmail: null, contactWhatsapp: null, paymentMethod: 'QRIS', archivedAt: null, canArchive: false, archiveReasonCodes: [], canRemove: false, removeReasonCodes: [], removedFromAdminAt: null,
    robloxDetail: { method: 'LOGIN', username: 'FixtureUser', gamepassUrl: null, gamepassPrice: null, robloxUserId: '42', gamepassVerifiedAt: null }, gameDetail: null,
    job: { evidence: null, attempts: [] }, audits: [] });
  const json = (route, data, status = 200) => route.fulfill({ status, json: data, headers: { 'cache-control': 'private, no-store' } });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { state.unexpected++; return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return fulfillFixtureRead(route, server);
    if (url.pathname === '/api/admin/fulfillment' && request.method() === 'GET') return json(route, { success: true, data: [row()], pagination: { nextCursor: null }, monitoring: { overdue: false, lastRun: null, pendingCount: 1, reviewCount: 0 } });
    if (url.pathname === '/api/admin/reauth') {
      state.auth++;
      if (request.postDataJSON().password !== 'synthetic-admin-password') return json(route, { success: false, errorCode: 'INVALID_CREDENTIALS' }, 401);
      state.authenticated = true; return json(route, { success: true });
    }
    if (url.pathname === '/api/admin/fulfillment/1') {
      assert.deepEqual(request.postDataJSON(), { action: 'reveal' }); state.reveals++;
      if (!state.authenticated) return json(route, { success: false, errorCode: 'REAUTH_REQUIRED' }, 403);
      if (mode === 'unavailable') return json(route, { success: false, errorCode: 'LOGIN_ACCESS_UNAVAILABLE' }, 404);
      return json(route, { success: true, data: { username: 'FixtureUser', ...loginCredentialsFixture(), displayUntil: new Date(Date.now() + 60_000).toISOString() } });
    }
    state.unexpected++; return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', () => state.errors++);
  const l = labels[locale], button = name => page.getByRole('button', { name, exact: true });
  async function start() { await page.goto(base + '/admin/commerce'); await button(l.open).waitFor(); }
  async function unlock() {
    await start(); await button(l.open).click(); await button(l.unlock).click();
    await page.getByLabel(l.admin, { exact: true }).fill('synthetic-admin-password'); await button(l.unlock).click();
  }
  async function clean() {
    const storage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    for (const value of ['synthetic-admin-password', loginCredentialsFixture().password, ...loginCredentialsFixture().backupCodes]) assert.equal(storage.includes(value), false);
    assert.equal(state.errors, 0); assert.equal(state.unexpected, 0);
  }
  return { context, page, state, l, button, start, unlock, clean };
}
try {
  for (const viewport of [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }]) for (const locale of ['ID', 'EN', 'MY']) await run(`${viewport.width} ${locale} admin reauth, masked access, keyboard close and no storage`, async () => {
    const f = await fixture(viewport, locale); try {
      await f.unlock(); const dialog = f.page.getByRole('dialog', { name: f.l.dialog });
      await dialog.locator('input[readonly]').first().waitFor(); assert.equal(await dialog.locator('input[type=password][readonly]').count(), 6);
      assert.equal(await dialog.locator('input:not([readonly])').count(), 0); assert.equal(f.state.reveals, 2); assert.equal(f.state.auth, 1);
      assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await f.page.screenshot({ path: path.join(output, `${viewport.width}-${locale}-masked.png`), fullPage: true });
      await f.button(f.l.show).click(); assert.equal(await dialog.locator('input[type=text][readonly]').count(), 6);
      assert.equal(await dialog.locator('input').first().inputValue(), loginCredentialsFixture().password);
      await f.button(f.l.close).focus(); await f.page.keyboard.press('Tab');
      assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true);
      await f.page.keyboard.press('Shift+Tab');
      assert.equal(await f.button(f.l.close).evaluate(element => element === document.activeElement), true);
      await f.page.keyboard.press('Escape'); assert.equal(await f.page.getByRole('dialog').count(), 0);
      await f.page.waitForFunction(label => document.activeElement?.textContent === label, f.l.open);
      const html = await f.page.locator('main').innerHTML(); for (const value of [loginCredentialsFixture().password, ...loginCredentialsFixture().backupCodes]) assert.equal(html.includes(value), false);
      await f.button(f.l.open).click(); assert.equal(await f.page.getByRole('dialog').locator('input[readonly]').count(), 0);
      await f.button(f.l.close).click(); await f.clean();
    } finally { await f.context.close(); }
  });
  await run('wrong admin password is explained and cannot reveal account access', async () => {
    const f = await fixture(); try {
      await f.start(); await f.button(f.l.open).click(); await f.button(f.l.unlock).click();
      await f.page.getByLabel(f.l.admin, { exact: true }).fill('wrong-synthetic-admin-password'); await f.button(f.l.unlock).click();
      await f.page.getByRole('alert').filter({ hasText: 'Incorrect admin password.' }).waitFor();
      assert.equal(await f.page.getByLabel(f.l.admin, { exact: true }).inputValue(), ''); assert.equal(await f.page.locator('dialog input[readonly]').count(), 0); assert.equal(f.state.reveals, 1);
      await f.page.getByLabel(f.l.admin, { exact: true }).fill('synthetic-admin-password'); await f.button(f.l.unlock).click();
      await f.page.locator('dialog input[readonly]').first().waitFor(); assert.equal(f.state.auth, 2); await f.clean();
    } finally { await f.context.close(); }
  });
  await run('admin access hides after sixty seconds without another request', async () => {
    const f = await fixture(); try {
      // Install before scheduling the application timer; existing real timers are not migrated.
      await f.page.clock.install(); await f.unlock(); await f.page.locator('dialog input[readonly]').first().waitFor();
      await f.page.clock.runFor(60_100); await f.page.getByRole('dialog').waitFor({ state: 'hidden' }); assert.equal(f.state.reveals, 2); await f.clean();
    } finally { await f.context.close(); }
  });
  await run('admin access clears on visibility loss and loss of assignment', async () => {
    const f = await fixture(); try {
      await f.unlock(); await f.page.locator('dialog input[readonly]').first().waitFor();
      await f.page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
      assert.equal(await f.page.getByRole('dialog').count(), 0);
      await f.page.evaluate(() => { delete document.hidden; });
      await f.button(f.l.open).click(); await f.button(f.l.unlock).click(); await f.page.locator('dialog input[readonly]').first().waitFor();
      // Inject a parent-list update; the modal correctly blocks a real background click.
      f.state.owned = false; await f.page.getByRole('button', { name: 'Refresh', exact: true }).evaluate(button => button.click());
      await f.button(f.l.open).waitFor({ state: 'hidden' }); assert.equal(await f.page.getByRole('dialog').count(), 0); await f.clean();
    } finally { await f.context.close(); }
  });
  await run('missing or expired access shows a safe error and no credentials', async () => {
    const f = await fixture(undefined, 'EN', 'unavailable'); try {
      await f.unlock(); await f.page.getByRole('alert').waitFor(); assert.equal(await f.page.locator('dialog input[readonly]').count(), 0);
      assert.equal((await f.page.locator('main').innerHTML()).includes(loginCredentialsFixture().password), false); await f.clean();
    } finally { await f.context.close(); }
  });
} finally { await browser.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
console.log(JSON.stringify({ PASS: results.filter(row => row.status === 'PASS').length, FAIL: results.filter(row => row.status === 'FAIL').length, SKIP: 0 }));
if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
