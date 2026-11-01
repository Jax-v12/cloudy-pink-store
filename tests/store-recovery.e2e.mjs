// Loopback renderer only. Error injection lives in an isolated build, never src/app.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3201';
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = '.cache/launch-readiness-20261101/recovery';
await fs.mkdir(output, { recursive: true });
const copy = {
  ID: { missing: 'Halaman tidak ditemukan', error: 'Halaman belum dapat dimuat', retry: 'Coba lagi' },
  EN: { missing: 'Page not found', error: 'This page could not load', retry: 'Try again' },
  MY: { missing: 'Halaman tidak ditemui', error: 'Halaman belum dapat dimuatkan', retry: 'Cuba lagi' },
};
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let passed = 0;
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const locale of ['ID', 'EN', 'MY']) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(value => localStorage.setItem('store_lang', value), locale);
    const denied = [];
    await context.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || request.method() !== 'GET' || url.pathname.startsWith('/api/')) {
        denied.push(request.method() + ' ' + url.pathname); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    try {
      const response = await page.goto(base + '/missing-public-page');
      assert.equal(response.status(), 404);
      await page.getByRole('heading', { name: copy[locale].missing, exact: true }).waitFor();
      assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
      const home = page.locator('[aria-labelledby="store-recovery-title"] a[href="/"]');
      await home.focus();
      assert.equal(await home.evaluate(el => el === document.activeElement), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/404-${width}-${locale}.png`, fullPage: true });
      await home.click();
      await page.locator('#invoice').waitFor();
      passed++;
      if (process.env.TEST_ERROR_RECOVERY_PATH) {
        assert.equal(process.env.TEST_ERROR_RECOVERY_PATH, '/qa-recovery-probe');
        await page.goto(base + process.env.TEST_ERROR_RECOVERY_PATH);
        await page.getByRole('button', { name: 'Trigger fixture error' }).click();
        await page.getByRole('heading', { name: copy[locale].error, exact: true }).waitFor();
        assert.equal((await page.locator('body').innerText()).includes('SYNTHETIC_INTERNAL_ERROR'), false);
        const retry = page.getByRole('button', { name: copy[locale].retry, exact: true });
        await retry.focus();
        assert.equal(await retry.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await page.screenshot({ path: `${output}/error-${width}-${locale}.png`, fullPage: true });
        await page.keyboard.press('Enter');
        await page.getByRole('button', { name: 'Trigger fixture error' }).waitFor();
        passed++;
      }
      assert.deepEqual(denied, []);
      console.log(`PASS ${width} ${locale} recovery`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
console.log(JSON.stringify({ passed, errorBoundary: process.env.TEST_ERROR_RECOVERY_PATH ? 'PASS' : 'NOT_RUN' }));
