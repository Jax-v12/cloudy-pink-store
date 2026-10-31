// Local renderer and synthetic catalog only; never submit an order or contact support.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3184';
assert.equal(new URL(base).hostname, '127.0.0.1');
const canonical = 'https://cloudy-pink-store.vercel.app';
const paths = ['/', '/apps', '/roblox', '/help', '/privacy'];
const output = '.cache/public-release-20261031/browser';
await fs.mkdir(output, { recursive: true });
const xml = await (await fetch(base + '/sitemap.xml')).text();
assert.deepEqual([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), paths.map(path => canonical + path));
const robots = await (await fetch(base + '/robots.txt')).text();
assert.ok(robots.includes('Sitemap: ' + canonical + '/sitemap.xml'));
for (const path of ['/admin', '/order', '/api']) assert.ok(robots.includes('Disallow: ' + path));

const results = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const locale of ['ID', 'EN', 'MY']) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(value => localStorage.setItem('store_lang', value), locale);
    const errors = [], unexpected = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || request.method() !== 'GET') { unexpected.push('BLOCKED_REQUEST'); return route.abort(); }
      if (url.pathname === '/api/products') return route.fulfill({ json: { success: true, data: [], pagination: { nextCursor: null }, location: { region: 'ID' }, paymentMethods: [] } });
      if (url.pathname.startsWith('/api/')) { unexpected.push('UNEXPECTED_API'); return route.abort(); }
      return route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on('pageerror', error => errors.push(error.message));
    const t = translations[locale];
    try {
      for (const path of paths) {
        const name = `${width} ${locale} ${path}`;
        await page.goto(base + path);
        await page.getByText(t.regional.indonesiaOnly, { exact: true }).waitFor();
        assert.equal(await page.locator('html').getAttribute('lang'), { ID: 'id', EN: 'en', MY: 'ms' }[locale]);
        const title = await page.title();
        assert.ok(title.includes('Cloudy Pink Store'));
        assert.equal(await page.locator('meta[property="og:title"]').getAttribute('content'), title);
        const description = await page.locator('meta[name="description"]').getAttribute('content');
        assert.ok(description.length > 20);
        assert.equal(await page.locator('meta[property="og:description"]').getAttribute('content'), description);
        assert.equal(await page.locator('meta[property="og:image"]').getAttribute('content'), canonical + '/banner-logo.png');
        assert.equal(await page.locator('meta[name="twitter:card"]').getAttribute('content'), 'summary_large_image');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        if (path === '/help' || path === '/privacy') {
          const contact = page.locator('main a[href^="https://wa.me/"]').first();
          await contact.waitFor();
          const url = new URL(await contact.getAttribute('href'));
          assert.equal(url.hostname, 'wa.me');
          assert.equal(url.searchParams.get('text'), t.whatsappGeneralMessage);
          assert.equal(await contact.getAttribute('rel'), 'noopener noreferrer');
          await contact.focus();
          await page.keyboard.press('Shift+Tab');
          await page.keyboard.press('Tab');
          assert.equal(await contact.evaluate(element => element === document.activeElement), true);
        }
        if (path === '/privacy') {
          await page.getByText(t.apps.privacyLogin, { exact: true }).waitFor();
          const terms = page.locator('main section a[href="/help#terms"]');
          assert.equal(await terms.innerText(), t.serviceHelp.terms);
        }
        if (path === '/help') {
          await page.locator('a[href="#terms"]').click();
          await page.getByRole('heading', { name: t.serviceHelp.terms, exact: true }).waitFor();
          await page.getByText(t.serviceHelp.supportBody, { exact: true }).waitFor();
        }
        assert.deepEqual(errors, []);
        assert.deepEqual(unexpected, []);
        if ((width === 375 && locale === 'ID' || width === 810 && locale === 'MY' || width === 1440 && locale === 'EN') && ['/help', '/privacy'].includes(path)) {
          await page.screenshot({ path: `${output}/${width}-${locale}-${path.slice(1)}.png`, fullPage: true });
        }
        results.push({ name, status: 'PASS' });
        console.log('PASS ' + name);
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
assert.equal(results.length, 45);
console.log('45 public metadata/help/privacy browser scenarios PASS; sitemap and robots PASS.');
