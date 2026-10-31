// Isolated renderer and synthetic APIs only; never create a real order/payment.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import { translations } from '../src/lib/translations.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3181';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const output = '.cache/review-fixes-20261030/storage';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const config = { version: 1, appGroup: 'Fixture', accountType: 'Individual', durationDays: 7, devices: 'One device',
  regionRules: 'Indonesia', included: 'Synthetic account', usageRules: 'Fixture only', instructions: 'Read the invoice',
  warrantyDays: 7, warrantyTerms: 'Fixture terms', fulfillmentMode: 'READY_ACCOUNT', activationMethod: null };
const product = { id: 1, name: 'Fixture App', slug: 'storage-fixture', price: 13000, category: 'Fixture', stockAvailable: 1, checkoutEnabled: true, appsConfig: config };
const invoice = 'INV-STORAGE-FIXTURE';
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const locale of ['ID', 'EN', 'MY']) for (const mode of ['blocked-read', 'blocked-before', 'quota-after', 'quota-invoice-error']) {
    const name = `${width} ${locale} ${mode}`;
    if (selected && !name.includes(selected)) continue;
    const t = translations[locale];
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    const errors = [], unexpected = [];
    let checkouts = 0, authorizedReads = 0;
    let invoiceError = mode === 'quota-invoice-error';
    await context.addInitScript(({ locale, mode }) => {
      localStorage.setItem('store_lang', locale);
      window.fixtureStorageBlocked = true;
      if (mode === 'blocked-read') {
        Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Fixture storage denied', 'SecurityError'); } });
      } else {
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (window.fixtureStorageBlocked && (key.startsWith('token_') || (mode === 'blocked-before' && key === 'cloudy_invoice_access_probe'))) throw new DOMException('Fixture quota', 'QuotaExceededError');
          return set.call(this, key, value);
        };
      }
    }, { locale, mode });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { unexpected.push('external'); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const json = data => route.fulfill({ json: { success: true, ...data } });
      if (url.pathname === '/api/products') return json({ data: [product], location: { region: 'ID' }, paymentMethods: [], pagination: { nextCursor: null } });
      if (url.pathname === '/api/checkout') { checkouts++; return json({ data: { invoice, accessToken: 'synthetic-storage-token' } }); }
      if (url.pathname === `/api/orders/${invoice}/payment`) return json({});
      if (url.pathname === `/api/orders/${invoice}`) {
        if (await request.headerValue('x-order-token') !== 'synthetic-storage-token') return route.fulfill({ status: 404, json: { success: false, errorCode: 'ORDER_NOT_FOUND' } });
        authorizedReads++;
        if (invoiceError) return route.fulfill({ status: 500, json: { success: false, errorCode: 'SYSTEM_ERROR' } });
        return json({ data: { invoice, type: 'APPS', status: 'PENDING', fulfillmentStatus: 'NOT_READY', refundStatus: 'NONE',
          product: { name: product.name }, totalAmount: 13000, productSubtotal: 13000, paymentFee: 0, discount: 0,
          currency: 'IDR', pricingRegion: 'ID', units: 1, paymentMethod: 'QRIS', account: null, otp: null,
          qrisCode: null, qrisUrl: null, expiresAt: new Date(Date.now() + 3600000).toISOString(), isAuthorized: true } });
      }
      unexpected.push(request.method() + ' ' + url.pathname);
      return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', () => errors.push('PAGE_ERROR'));
    page.on('dialog', dialog => dialog.dismiss());
    try {
      if (mode === 'blocked-read') {
        await page.goto(base + '/');
        await page.getByText(translations.ID.commerce.portalTitle, { exact: true }).waitFor();
        await page.getByRole('button', { name: locale, exact: true }).click();
        await page.getByText(t.commerce.portalTitle, { exact: true }).waitFor();
        assert.equal(await page.locator('html').getAttribute('lang'), { ID: 'id', EN: 'en', MY: 'ms' }[locale]);
      } else {
        await page.goto(base + '/apps/' + product.slug);
        await page.getByLabel(t.apps.email, { exact: true }).fill('fixture@example.test');
        await page.getByRole('checkbox').check();
        await page.getByRole('button', { name: t.btnPayNow, exact: true }).click();
        if (mode === 'blocked-before') {
          await page.getByText(t.invoiceStorageRequired, { exact: true }).waitFor();
          assert.equal(checkouts, 0);
        } else {
          await page.waitForURL(base + '/order/' + invoice);
          if (invoiceError) await page.getByText(t.errSystem, { exact: true }).waitFor();
          else await page.getByRole('heading', { name: t.orderTitle, exact: true }).waitFor();
          await page.getByText(t.invoiceAccessUnsaved, { exact: true }).waitFor();
          await page.screenshot({ path: `${output}/${width}-${locale}-${mode}.png` });
          assert.equal(checkouts, 1);
          assert.ok(authorizedReads > 0);
          await page.getByRole('button', { name: t.saveInvoiceAccess, exact: true }).click();
          assert.equal(await page.getByText(t.invoiceAccessUnsaved, { exact: true }).count(), 1);
          await page.evaluate(() => { window.fixtureStorageBlocked = false; });
          await page.getByRole('button', { name: t.saveInvoiceAccess, exact: true }).click();
          await page.getByText(t.invoiceAccessUnsaved, { exact: true }).waitFor({ state: 'detached' });
          invoiceError = false;
          await page.reload();
          await page.getByRole('heading', { name: t.orderTitle, exact: true }).waitFor();
          assert.equal(checkouts, 1);
        }
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
      results.push({ case: name, result: 'PASS' });
    } catch (error) { results.push({ case: name, result: 'FAIL', error: error.message }); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify(results, null, 2));
if (results.some(row => row.result === 'FAIL')) process.exitCode = 1;
