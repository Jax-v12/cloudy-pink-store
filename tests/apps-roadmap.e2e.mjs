// Renderer fixtures only. All API and external traffic is intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fulfillFixtureRead } from './browser-fixture-transport.mjs';
import { appsTranslations } from '../src/lib/appsTranslations.ts';
import { translations } from '../src/lib/translations.ts';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'C:/Users/Jacob/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const server = 'http://127.0.0.1:3167', base = 'https://store.invalid';
const output = '.cache/benchmark-20261019/browser'; await fs.mkdir(output, { recursive: true });
const config = { version: 1, appGroup: 'Synthetic', accountType: 'Private', durationDays: 7, devices: 'One device', regionRules: 'ID', usageRules: 'Synthetic usage rules', included: 'Synthetic premium access', instructions: 'Synthetic guide', warrantyDays: 7, warrantyTerms: 'Synthetic seven-day policy', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' };
const product = { id: 1, slug: 'synthetic-capcut', name: 'Synthetic CapCut Private with a long package name', category: 'Video', price: 1000, stockAvailable: 0, checkoutEnabled: true, appsConfig: config, appsPolicyToken: 'a'.repeat(64) };
const order = { invoice: 'INV-SYNTHETIC-APPS', type: 'APPS', status: 'PAID', fulfillmentStatus: 'WAITING_CUSTOMER', refundStatus: 'NONE', product: { name: product.name },
  totalAmount: 1000, currency: 'IDR', pricingRegion: 'ID', productSubtotal: 1000, paymentFee: 0, discount: 0, units: 1, paymentMethod: 'QRIS', qrisUrl: null, qrisCode: null,
  account: null, otp: null, robloxDetail: null, gameDetail: null, isAuthorized: true, expiresAt: '2099-01-01', paidAt: new Date().toISOString(),
  appsSnapshot: config, appsWarranty: { active: false, expiresAt: null, legacy: false, days: 7 }, appsSupport: null,
  appsService: { deliveredAt: new Date().toISOString(), acknowledgedAt: null, activeFrom: null, activeUntil: null, delivery: 'Synthetic invitation instructions' } };
const results = []; const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const locale of ['ID', 'EN', 'MY']) {
    const a = appsTranslations[locale], t = translations[locale];
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(locale => { localStorage.setItem('store_lang', locale); localStorage.setItem('token_INV-SYNTHETIC-APPS', 'synthetic-only'); }, locale);
    let failed = true, ack = false, querySeen = false, mutationCount = 0, expired = false; const errors = [];
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === '/api/products') {
        if (failed) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) });
        querySeen ||= url.searchParams.get('q') === 'Beyond';
        return route.fulfill({ json: { success: true, data: [product], pagination: { nextCursor: null } } });
      }
      if (url.pathname === '/api/orders/INV-SYNTHETIC-APPS') return route.fulfill({ json: { success: true, data: { ...order, appsService: { ...order.appsService, deliveredAt: expired ? '2020-01-01T00:00:00Z' : order.appsService.deliveredAt, acknowledgedAt: ack ? new Date().toISOString() : null } } } });
      if (url.pathname === '/api/orders/INV-SYNTHETIC-APPS/apps') { mutationCount++; ack = true; return route.fulfill({ json: { success: true } }); }
      if (url.pathname === '/api/admin/apps/products') return route.fulfill({ json: { success: true, data: [], pagination: { nextCursor: null } } });
      if (url.pathname === '/api/admin/apps/orders') return route.fulfill({ json: { success: true, data: [], pagination: { nextCursor: null } } });
      if (url.pathname === '/api/admin/metrics' && route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: { observations: [], paid: [] } } });
      if (url.pathname === '/api/admin/apps/reminders' && route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: [], pagination: { nextCursor: null } } });
      if (url.pathname.startsWith('/api/')) throw new Error(`UNEXPECTED_API_REQUEST ${route.request().method()} ${url.pathname}`);
      try { return await fulfillFixtureRead(route, server); }
      catch (error) { if (route.request().failure()?.errorText === 'net::ERR_ABORTED') return; throw error; }
    });
    try {
      await page.goto(base + '/apps'); await page.getByRole('alert').filter({ hasText: t.errSystem }).waitFor();
      assert.equal(await page.getByText(t.emptyCatalog, { exact: true }).count(), 0);
      failed = false; await page.getByRole('button', { name: a.retry, exact: true }).click(); await page.getByRole('link', { name: a.details, exact: true }).waitFor();
      await page.getByRole('searchbox').fill('Beyond'); await page.getByRole('searchbox').press('Enter');
      await page.getByRole('link', { name: a.details, exact: true }).waitFor(); assert.equal(querySeen, true);
      await page.getByRole('link', { name: a.details, exact: true }).click(); await page.getByText(config.warrantyTerms, { exact: true }).waitFor();
      await page.getByRole('textbox', { name: a.email, exact: true }).fill('fixture@example.test');
      assert.equal(await page.getByRole('button', { name: t.btnPayNow, exact: true }).isDisabled(), true);
      await page.getByRole('checkbox', { name: a.agree }).check();
      assert.equal(await page.getByRole('button', { name: t.btnPayNow, exact: true }).isEnabled(), true);
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/${width}-${locale}-package.png`, fullPage: true });
      await page.goto(base + '/order/INV-SYNTHETIC-APPS'); await page.getByRole('button', { name: a.acknowledge, exact: true }).waitFor();
      await page.getByRole('button', { name: a.acknowledge, exact: true }).click(); await page.getByText(a.acknowledged, { exact: true }).waitFor();
      assert.equal(mutationCount, 1); assert.equal(errors.length, 0, errors.join('\n'));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator('html').getAttribute('lang'), { ID: 'id', EN: 'en', MY: 'ms' }[locale]);
      await page.screenshot({ path: `${output}/${width}-${locale}-invoice.png`, fullPage: true });
      expired = true; await page.reload(); await page.getByText(config.instructions, { exact: true }).waitFor();
      assert.equal(await page.getByText(order.appsService.delivery, { exact: true }).count(), 0);
      await page.goto(base + '/admin/apps'); await page.getByRole('heading', { name: a.manage, exact: true }).waitFor();
      await page.getByRole('button', { name: a.newProduct, exact: true }).click();
      await page.getByRole('textbox', { name: a.name, exact: true }).fill('Synthetic long product name');
      assert.equal(await page.getByRole('checkbox', { name: a.active, exact: true }).isChecked(), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/${width}-${locale}-admin.png`, fullPage: true });
      results.push({ width, locale, status: 'PASS' }); console.log(`PASS ${width} ${locale} catalog/error/search/detail/invoice/admin`);
    } catch (e) { results.push({ width, locale, status: 'FAIL', reason: e.message }); console.log(`FAIL ${width} ${locale}: ${e.message.slice(0, 350)}`); }
    finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
  }
} finally { await browser.close(); }
await fs.writeFile(output + '/results.json', JSON.stringify(results, null, 2));
assert.equal(results.filter(r => r.status === 'FAIL').length, 0);
