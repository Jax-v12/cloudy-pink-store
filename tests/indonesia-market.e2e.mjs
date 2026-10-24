// Renderer + real catalog handler with in-memory products; no database or provider access.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { geoHeaders, geoSecret, geoAudience } from './geo-fixture.mjs';
import { fulfillFixtureRead } from './browser-fixture-transport.mjs';
import { regionalTranslations } from '../src/lib/regionalTranslations.ts';
import { appsTranslations } from '../src/lib/appsTranslations.ts';
import { translations } from '../src/lib/translations.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3178';
const base = 'https://store.invalid';
const output = '.cache/indonesia-launch-20261024/browser';
await fs.mkdir(output, { recursive: true });
Object.assign(process.env, { GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret, GEOIP_INGRESS_AUDIENCE: geoAudience,
  ROBLOX_CHECKOUT_ENABLED: 'true', MIDTRANS_SERVER_KEY: 'isolated-browser-fixture', CHECKOUT_HASH_KEY: 'isolated-browser-fixture' });
delete process.env.DATABASE_URL;
const config = { version: 1, appGroup: 'Synthetic', accountType: 'Private', durationDays: 7, devices: 'One device', regionRules: 'Indonesia',
  usageRules: 'Synthetic usage rules', included: 'Synthetic access', instructions: 'Synthetic guide', warrantyDays: 7,
  warrantyTerms: 'Synthetic policy', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' };
const apps = { id: 1, type: 'APPS', slug: 'fixture', name: 'Synthetic premium package', price: 13000,
  category: 'Video', coverImage: null, appsConfig: config, variants: [], _count: { stocks: 0 } };
const roblox = ['GAMEPASS', 'GIFT_USERNAME', 'LOGIN'].map((method, index) => ({ id: index + 2, type: 'ROBLOX', slug: `fixture-${method.toLowerCase()}`,
  name: `Synthetic ${method}`, price: 0, category: 'Roblox', appsConfig: null, _count: { stocks: 0 },
  variants: [{ id: index + 2, name: 'Synthetic 100 Robux', price: 15000, units: 100, maxUnits: 1000, unitStep: 100,
    method, gamepassPrice: null, requiresZone: false, regionalPrices: [{ region: 'MY', amount: 500, active: true }] }] }));
globalThis.prisma = { product: { findMany: async ({ where }) => (where.type === 'ROBLOX' ? roblox : [apps]).filter(row => !where.slug || where.slug === row.slug) } };
const { GET: catalog } = await import('../src/app/api/products/route.ts');
const order = { invoice: 'INV-fixture', type: 'APPS', status: 'PAID', fulfillmentStatus: 'COMPLETED', refundStatus: 'NONE', product: { name: apps.name },
  totalAmount: 13000, currency: 'IDR', pricingRegion: 'ID', productSubtotal: 13000, paymentFee: 0, discount: 0, units: 1, paymentMethod: 'QRIS',
  qrisUrl: null, qrisCode: null, account: null, otp: null, robloxDetail: null, gameDetail: null, isAuthorized: true, expiresAt: '2099-01-01', paidAt: new Date().toISOString(),
  appsSnapshot: config, appsWarranty: { active: true, expiresAt: null, legacy: false, days: 7 }, appsSupport: null,
  appsService: { deliveredAt: new Date().toISOString(), acknowledgedAt: null, activeFrom: '2020-01-01', activeUntil: '2020-01-08', delivery: 'Synthetic instructions' } };
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const language of ['ID', 'EN', 'MY']) {
    const t = translations[language], a = appsTranslations[language], r = regionalTranslations[language];
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(value => { localStorage.setItem('store_lang', value); localStorage.setItem('token_INV-fixture', 'synthetic-access'); }, language);
    let country = 'ID', checkoutRequests = 0;
    const errors = [];
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== base) { errors.push('UNEXPECTED_EXTERNAL_REQUEST'); return route.abort(); }
      if (url.pathname === '/api/products') {
        const response = await catalog(new Request(url, { headers: country ? geoHeaders(url, country) : {} }));
        return route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() });
      }
      if (url.pathname === '/api/checkout') {
        checkoutRequests++;
        return route.fulfill({ status: 409, json: { success: false, errorCode: 'REGION_UNVERIFIED' } });
      }
      if (url.pathname === '/api/orders/INV-fixture') return route.fulfill({ json: { success: true, data: order } });
      if (url.pathname === '/api/orders/INV-fixture/renew') return route.fulfill({ status: 409, json: { success: false, errorCode: 'REGION_UNVERIFIED' } });
      if (url.pathname.startsWith('/api/')) { errors.push(`UNEXPECTED_API ${url.pathname}`); return route.abort(); }
      return fulfillFixtureRead(route, server);
    });
    try {
      await page.goto(base); await page.getByText(r.indonesiaOnly, { exact: true }).waitFor();
      for (country of ['ID', 'MY', 'PH', null]) {
        await page.goto(base + '/apps');
        await page.getByRole('link', { name: a.details, exact: true }).waitFor();
        assert.equal(await page.locator('html').getAttribute('lang'), { ID: 'id', EN: 'en', MY: 'ms' }[language]);
        if (country !== 'ID') {
          await page.getByText(r.locationUnavailable, { exact: true }).waitFor();
          assert.equal(await page.getByText(r.unavailable, { exact: true }).count(), 1);
        }
        await page.getByRole('link', { name: a.details, exact: true }).click();
        await page.getByText(config.warrantyTerms, { exact: true }).waitFor();
        await page.getByRole('textbox', { name: a.email, exact: true }).fill('fixture@example.test');
        await page.getByRole('checkbox', { name: a.agree }).check();
        const pay = page.getByRole('button', { name: t.btnPayNow, exact: true });
        assert.equal(await pay.isEnabled(), country === 'ID');
        if (country === 'ID') {
          await page.getByRole('checkbox', { name: a.agree }).focus(); await page.keyboard.press('Tab');
          assert.equal(await pay.evaluate(element => element === document.activeElement), true);
        } else {
          await page.getByText(r.locationUnavailable, { exact: true }).waitFor();
          assert.ok((await page.getByText(r.unavailable, { exact: false }).count()) > 0);
          assert.equal(await page.getByText(/13[.,]000/).count(), 0);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (country === null) await page.screenshot({ path: `${output}/${width}-${language}-apps-unavailable.png`, fullPage: true });
        await page.goto(base + '/roblox');
        await page.getByText(r.indonesiaOnly, { exact: true }).waitFor();
        if (country === 'ID') {
          for (const method of ['GAMEPASS', 'GIFT_USERNAME', 'LOGIN']) await page.locator(`a[href*="method=${method}"]`).waitFor();
        } else {
          await page.getByText(r.locationUnavailable, { exact: true }).first().waitFor();
          assert.equal(await page.locator('a[href*="?method="]').count(), 0);
          assert.equal(await page.getByText(/15[.,]000/).count(), 0);
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        assert.equal(checkoutRequests, 0);
        assert.deepEqual(errors, []);
        results.push({ width, height, language, country, status: 'PASS' });
      }
      country = 'ID';
      await page.goto(base + '/apps/fixture'); await page.getByText(config.warrantyTerms, { exact: true }).waitFor();
      await page.getByRole('textbox', { name: a.email, exact: true }).fill('fixture@example.test');
      await page.getByRole('checkbox', { name: a.agree }).check();
      await page.getByRole('button', { name: t.btnPayNow, exact: true }).click();
      await page.getByRole('alert').getByText(r.locationUnavailable, { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: t.btnPayNow, exact: true }).isDisabled(), true);
      assert.equal(checkoutRequests, 1);
      country = null;
      await page.goto(base + '/order/INV-fixture'); await page.getByRole('button', { name: a.renew, exact: true }).click();
      await page.getByRole('alert').getByText(r.locationUnavailable, { exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog').count(), 0);
      assert.deepEqual(errors, []);
      results.push({ width, height, language, scenario: 'location drift and renewal unavailable; existing invoice accessible', status: 'PASS' });
      console.log(JSON.stringify({ width, language, scenarios: 5, status: 'PASS' }));
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await fs.writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ scenarios: results.length, evidence: 'local renderer and handler with synthetic fixtures; no DB/provider' }));
