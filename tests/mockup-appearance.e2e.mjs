// Local renderer and synthetic API fixtures only; no provider, DB or customer writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3144';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = path.resolve('.cache/storefront-polish-20261029/browser');
const selectedCase = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const config = { version: 1, appGroup: 'Fixture App', accountType: 'Individual', durationDays: 30,
  devices: 'One device', regionRules: 'Indonesia', usageRules: 'Synthetic fixture', included: 'Account',
  instructions: 'Check the invoice', warrantyDays: 7, warrantyTerms: 'Fixture terms', fulfillmentMode: 'READY_ACCOUNT', activationMethod: null };
const apps = [{ id: 10, name: 'Fixture Premium', slug: 'fixture-premium', category: 'Fixture', price: 15000,
  stockAvailable: 1, checkoutEnabled: true, appsConfig: config }];
const products = [{ id: 1, slug: 'fixture', name: 'Fixture Roblox', checkoutEnabled: true,
  variants: [100, 200, 400, 800].map((units, index) => ({ id: index + 1, name: index === 3 ? 'Fixture special package' : `${units} Robux`, units, price: units * 85, method: 'LOGIN' })) }];
const qr = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="224" height="224"><rect width="224" height="224" fill="white"/><rect x="20" y="20" width="184" height="184" fill="black"/><rect x="35" y="35" width="154" height="154" fill="white"/><text x="112" y="120" text-anchor="middle" font-size="24">FIXTURE</text></svg>');
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const locale of ['ID', 'EN', 'MY']) {
    if (selectedCase && selectedCase !== `${width} ${locale}`) continue;
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(value => localStorage.setItem('store_lang', value), locale);
    const errors = [], unexpected = [];
    let invoiceState = 'PENDING';
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { unexpected.push('external'); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const fulfill = data => route.fulfill({ json: { success: true, ...data } });
      if (url.pathname === '/api/products') return fulfill({ data: url.searchParams.get('type') === 'ROBLOX' ? products : apps,
        location: { region: 'ID' }, paymentMethods: [{ id: 'qris', label: 'QRIS' }], pagination: { nextCursor: null } });
      if (url.pathname === '/api/checkout/session') return fulfill({ data: { outcome: 'READY' } });
      if (url.pathname === '/api/orders/INV-FIXTURE-DESIGN/payment') return fulfill({});
      if (url.pathname === '/api/orders/INV-FIXTURE-DESIGN') return fulfill({ data: {
        invoice: 'INV-FIXTURE-DESIGN', type: 'ROBLOX', status: invoiceState === 'PENDING' ? 'PENDING' : 'PAID',
        fulfillmentStatus: invoiceState === 'COMPLETED' ? 'COMPLETED' : invoiceState === 'PENDING' ? 'NOT_READY' : 'QUEUED',
        refundStatus: 'NONE', product: { name: 'Fixture Roblox' }, units: 100, variantName: '100 Robux',
        totalAmount: 8500, productSubtotal: 8500, paymentFee: 0, discount: 0, currency: 'IDR', pricingRegion: 'ID',
        paymentMethod: 'QRIS', qrisUrl: invoiceState === 'PENDING' ? qr : null, qrisCode: null,
        expiresAt: new Date(Date.now() + 3600000).toISOString(), account: null, gameDetail: null, isAuthorized: true,
        robloxDetail: { method: 'LOGIN', username: 'FixtureUser', gamepassPrice: null },
      } });
      unexpected.push(request.method() + ' ' + url.pathname);
      return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', () => errors.push('PAGE_ERROR'));
    const capture = async name => {
      await page.evaluate(() => document.fonts.ready);
      await page.locator('main').waitFor();
      await page.evaluate(async () => Promise.all([...document.images].map(image => image.decode().catch(() => {}))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow');
      assert.deepEqual(errors, [], 'browser errors');
      assert.deepEqual(unexpected, [], 'unexpected request');
      assert.equal(await page.locator('main img').evaluateAll(images => images.some(image => !image.complete || !image.naturalWidth)), false, 'broken image');
      const contact = page.getByRole('link', { name: translations[locale].contactAdmin, exact: true });
      if (width < 640 && await contact.count()) {
        assert.equal(await contact.evaluate(el => {
          const button = el.getBoundingClientRect();
          return [...document.querySelectorAll('article, a.group')].some(card => {
            const box = card.getBoundingClientRect();
            return button.left < box.right && button.right > box.left && button.top < box.bottom && button.bottom > box.top;
          });
        }), false, 'mobile contact link must not cover product or service cards');
        assert.ok((await contact.boundingBox()).height >= 44, 'contact touch target');
      }
      await page.screenshot({ path: path.join(output, `${name}-${width}-${locale}.png`), fullPage: true });
      results.push({ name: `${name} ${width} ${locale}`, status: 'PASS' });
    };
    try {
      await page.goto(base); await page.locator('#invoice').waitFor(); await capture('home');
      await page.locator('#invoice').fill('INV-FIXTURE-DESIGN');
      await page.locator('form').getByRole('button').click();
      await page.waitForURL('**/order/INV-FIXTURE-DESIGN');
      await page.getByRole('button', { name: translations[locale].btnDownloadQris }).waitFor();
      assert.equal(await page.locator('img[alt="QRIS Barcode"]').evaluate(el => Boolean(el.compareDocumentPosition(document.querySelector('#order-progress-title')) & Node.DOCUMENT_POSITION_FOLLOWING)), true, 'pending QRIS must precede delivery progress in reading order');
      await capture('invoice-pending');
      for (const state of ['PAID', 'COMPLETED']) {
        invoiceState = state; await page.reload();
        await page.getByRole('heading', { name: translations[locale].serviceHelp.progress.title }).waitFor();
        const progressY = await page.locator('#order-progress-title').evaluate(el => el.getBoundingClientRect().top);
        const invoiceY = await page.getByText('INV-FIXTURE-DESIGN', { exact: true }).evaluate(el => el.getBoundingClientRect().top);
        assert.ok(progressY < invoiceY, 'paid delivery progress must precede invoice details');
        assert.equal(await page.getByRole('button', { name: translations[locale].btnDownloadQris }).count(), 0);
        await capture('invoice-' + state.toLowerCase());
      }
      await page.goto(base + '/apps'); await page.locator('article').waitFor();
      assert.match(await page.locator('article').innerText(), /30/);
      assert.match(await page.locator('article').innerText(), /7/);
      await capture('apps');
      await page.goto(base + '/roblox/fixture?method=LOGIN');
      const packages = page.locator('input[name=package]'); await packages.first().waitFor();
      assert.equal(await packages.count(), 4);
      assert.equal(await page.getByText('100 Robux', { exact: true }).count(), 1, 'package amount should appear once');
      assert.equal(await page.getByText('Fixture special package', { exact: true }).count(), 1, 'distinct package names must remain visible');
      if (width >= 640) {
        const cards = await packages.evaluateAll(inputs => inputs.map(input => input.closest('label').getBoundingClientRect().top));
        assert.equal(cards[0], cards[1]); assert.equal(cards[1], cards[2]); assert.ok(cards[3] > cards[2], 'three columns');
      }
      await capture('login-packages');
      console.log(`PASS ${width} ${locale}: six views, image loading, tracking, Apps terms and Login grid`);
    } catch (error) { results.push({ name: `${width} ${locale}`, status: 'FAIL', reason: error.message }); console.log(`FAIL ${width} ${locale}: ${error.message}`); }
    finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
  }
} finally { await browser.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
console.log(JSON.stringify({ passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length }));
if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
