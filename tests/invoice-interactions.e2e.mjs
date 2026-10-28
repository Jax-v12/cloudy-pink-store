// Clipboard is stubbed: synthetic invoice only, no OS clipboard/DB/provider writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || process.argv[2] || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3144';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
try {
  for (const locale of ['ID', 'EN', 'MY']) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block' });
    await context.addInitScript(locale => {
      localStorage.setItem('store_lang', locale);
      window.__copyMode = 'denied'; window.__copyCalls = 0;
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => {
        window.__copyCalls++;
        if (window.__copyMode === 'denied') return Promise.reject(new DOMException('Synthetic denial', 'NotAllowedError'));
        return new Promise(resolve => { window.__finishCopy = resolve; });
      } } });
    }, locale);
    const errors = [], unexpected = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { unexpected.push('external'); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (url.pathname !== '/api/orders/INV-FIXTURE-COPY' || request.method() !== 'GET') { unexpected.push(url.pathname); return route.abort(); }
      return route.fulfill({ json: { success: true, data: {
        invoice: 'INV-FIXTURE-COPY', type: 'APPS', status: 'PAID', fulfillmentStatus: 'COMPLETED', refundStatus: 'NONE',
        product: { name: 'Synthetic Apps' }, variantName: null, units: 1, totalAmount: 1000, productSubtotal: 1000,
        paymentFee: 0, discount: 0, currency: 'IDR', pricingRegion: 'ID', paymentMethod: 'QRIS', qrisUrl: null, qrisCode: null,
        expiresAt: '2099-01-01', createdAt: new Date().toISOString(), paidAt: new Date().toISOString(),
        account: { emailAccount: 'fixture@example.invalid', passwordAccount: 'synthetic-only', profileName: null, pin: null, additionalInfo: null },
        otp: { status: 'DELIVERED', requestId: 1, code: '123456', updatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() },
        robloxDetail: null, gameDetail: null, isAuthorized: true,
      } } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', () => errors.push('PAGE_ERROR'));
    try {
      const t = translations[locale];
      await page.goto(base + '/order/INV-FIXTURE-COPY');
      for (const [buttonLabel, successLabel] of [[t.btnCopyAccount, t.accountCopied], [t.btnCopyOtp, t.copiedNotice]]) {
        const button = page.getByRole('button', { name: buttonLabel, exact: true });
        await page.evaluate(() => { window.__copyMode = 'denied'; });
        await button.click();
        await page.getByRole('alert').filter({ hasText: t.copyFailed }).waitFor();
        assert.equal(await page.getByRole('button', { name: successLabel, exact: true }).count(), 0, 'denied copy must not report success');
        await page.evaluate(() => { window.__copyMode = 'pending'; });
        await button.click();
        assert.equal(await page.getByRole('button', { name: successLabel, exact: true }).count(), 0, 'pending copy must not report success');
        await page.evaluate(() => window.__finishCopy());
        await page.getByRole('button', { name: successLabel, exact: true }).waitFor();
      }
      assert.equal(await page.evaluate(() => window.__copyCalls), 4);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { value: undefined }));
      await page.getByRole('button', { name: t.btnCopyAccount, exact: true }).click();
      await page.getByRole('alert').filter({ hasText: t.copyFailed }).waitFor();
      assert.equal(await page.getByRole('button', { name: t.accountCopied, exact: true }).count(), 0, 'unavailable clipboard must not report success');
      assert.equal(errors.length, 0, 'no unhandled clipboard errors'); assert.deepEqual(unexpected, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      results.push({ locale, status: 'PASS' }); console.log('PASS ' + locale + ' denied/pending/successful account and OTP copy');
    } catch (error) { results.push({ locale, status: 'FAIL', reason: error.message }); console.log('FAIL ' + locale + ': ' + error.message.slice(0, 200)); }
    finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
  }
} finally { await browser.close(); await fs.writeFile('.cache/interaction-20261028/invoice-interactions.json', JSON.stringify(results, null, 2)); }
if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
