// Local renderer fixtures only; all order/payment traffic is intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const renderer = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3178';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(renderer).hostname));
const origin = renderer;
const output = '.cache/indonesia-copy-20261025/browser';
await fs.mkdir(output, { recursive: true });
const invoice = 'INV-SYNTHETIC-COPY';
const order = { invoice, type: 'APPS', status: 'PENDING', fulfillmentStatus: 'NOT_READY', refundStatus: 'NONE',
  product: { name: 'Paket Uji Bahasa' }, totalAmount: 13000, currency: 'IDR', pricingRegion: 'ID', productSubtotal: 13000,
  paymentFee: 0, discount: 0, units: 1, paymentMethod: 'QRIS', account: null, otp: null,
  qrisCode: '000201-SYNTHETIC-NOT-PAYABLE',
  qrisUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=',
  expiresAt: new Date(Date.now() + 7200000).toISOString(), createdAt: new Date().toISOString(), paidAt: null, isAuthorized: true };
const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) {
    const context = await browser.newContext({ viewport: { width, height }, locale: 'en-US', serviceWorkers: 'block' });
    await context.addInitScript(({ invoice }) => localStorage.setItem('token_' + invoice, 'synthetic-access-only'), { invoice });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) { errors.push('UNEXPECTED_EXTERNAL_REQUEST'); return route.abort(); }
      if (url.pathname === '/api/products') return route.fulfill({ json: { success: true, data: [], pagination: { nextCursor: null },
        location: { region: 'ID', reason: 'detected' }, paymentMethods: [{ id: 'QRIS', label: 'QRIS', provider: 'MIDTRANS' }] } });
      if (url.pathname === '/api/orders/' + invoice) return route.fulfill({ json: { success: true, data: order } });
      if (url.pathname === '/api/orders/' + invoice + '/payment') return route.fulfill({ json: { success: true, data: { status: 'PENDING' } } });
      if (url.pathname.startsWith('/api/')) { errors.push('UNEXPECTED_API ' + url.pathname); return route.abort(); }
      return route.continue();
    });
    try {
      await page.goto(origin);
      await page.getByText(translations.ID.commerce.portalTitle, { exact: true }).waitFor();
      assert.equal(await page.locator('html').getAttribute('lang'), 'id', 'Indonesian default ignores browser language');
      assert.equal(await page.evaluate(() => localStorage.getItem('store_lang')), null);
      for (const language of ['ID', 'EN', 'MY']) {
        const t = translations[language];
        await page.getByRole('button', { name: language, exact: true }).click();
        await page.getByText(t.commerce.portalTitle, { exact: true }).waitFor();
        await page.reload(); await page.getByText(t.commerce.portalTitle, { exact: true }).waitFor();
        for (const path of ['/apps', '/roblox', '/help', '/privacy']) {
          await page.goto(origin + path);
          await page.getByText(t.regional.indonesiaOnly, { exact: true }).waitFor();
          assert.equal(await page.locator('html').getAttribute('lang'), { ID: 'id', EN: 'en', MY: 'ms' }[language]);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, path + ' overflow');
        }
        await page.goto(origin + '/order/' + invoice);
        await page.getByText(t.scanNoticeTitle, { exact: true }).waitFor();
        await page.getByText(t.scanNoticeSubtitle, { exact: true }).waitFor();
        await page.getByRole('button', { name: t.btnDownloadQris, exact: true }).waitFor();
        const [download] = await Promise.all([
          page.waitForEvent('download'),
          page.getByRole('button', { name: t.btnDownloadQris, exact: true }).click(),
        ]);
        assert.equal(download.suggestedFilename(), `QRIS-${invoice}.png`);
        await download.cancel();
        assert.doesNotMatch(await page.locator('body').innerText(), /DuitNow|Touch n Go|Maybank MAE/);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'invoice overflow');
        await page.screenshot({ path: `${output}/${width}-${language}-invoice.png`, fullPage: true });
        await page.goto(origin); await page.getByText(t.commerce.portalTitle, { exact: true }).waitFor();
        if (language === 'ID') await page.screenshot({ path: `${output}/${width}-ID-home.png`, fullPage: true });
        assert.deepEqual(errors, []);
        results.push({ width, height, language, status: 'PASS' });
        console.log(JSON.stringify({ width, language, status: 'PASS' }));
      }
    } finally {
      await context.unrouteAll({ behavior: 'wait' });
      await context.close();
    }
  }
} finally {
  await browser.close();
  await fs.writeFile(output + '/results.json', JSON.stringify(results, null, 2));
}
console.log(JSON.stringify({ scenarios: results.length, evidence: 'renderer fixtures; no database or provider calls' }));
