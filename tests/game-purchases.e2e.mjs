import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3186';
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = '.cache/game-purchases-20261031/browser';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let passed = 0;
try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const language of ['ID', 'EN', 'MY']) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    await context.addInitScript(value => localStorage.setItem('store_lang', value), language);
    const errors = [], unexpected = [], apiCalls = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base || request.method() !== 'GET') { unexpected.push(url.pathname); return route.abort(); }
      if (url.pathname.startsWith('/api/')) {
        apiCalls.push(url.pathname);
        if (url.pathname === '/api/products') return route.fulfill({ json: {
          success: true, data: [], pagination: { nextCursor: null }, location: { region: 'ID' }, paymentMethods: [],
        } });
        unexpected.push(url.pathname); return route.abort();
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const t = translations[language], c = t.commerce;
    try {
      await page.goto(base);
      await page.getByRole('heading', { name: c.portalTitle, exact: true }).waitFor();
      await page.getByRole('heading', { name: c.APPS, exact: true }).waitFor();
      assert.equal(await page.locator('a[href^="/games"]').count(), 0);
      const cards = page.locator('section > a[href="/apps"], section > a[href="/roblox"]');
      assert.equal(await cards.count(), 2);
      const boxes = await cards.evaluateAll(elements => elements.map(el => {
        const { x, y, width } = el.getBoundingClientRect(); return { x, y, width };
      }));
      if (width >= 768) {
        assert.equal(boxes[0].y, boxes[1].y);
        assert.ok(Math.abs(boxes[0].width - boxes[1].width) <= 1);
      } else assert.ok(boxes[1].y > boxes[0].y);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: `${output}/home-${width}-${language}.png`, fullPage: true });
      passed++;
      for (const path of ['/games', '/games/legacy-game']) {
        await page.goto(base + path);
        await page.getByRole('heading', { name: c.gamePausedTitle, exact: true }).waitFor();
        await page.getByText(c.gamePausedDescription, { exact: true }).waitFor();
        assert.equal(await page.locator('nav a[href^="/games"]').count(), 0);
        assert.equal(await page.locator('main form, main input, main button[type="submit"]').count(), 0);
        assert.deepEqual(apiCalls, [], 'Paused Game pages must not load a catalog or call checkout');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const panel = page.locator('section[aria-labelledby="game-paused-title"]');
        const apps = panel.locator('a[href="/apps"]'), roblox = panel.locator('a[href="/roblox"]');
        await apps.focus(); await page.keyboard.press('Tab');
        assert.equal(await roblox.evaluate(el => el === document.activeElement), true);
        if (path === '/games') await page.screenshot({ path: `${output}/${width}-${language}.png`, fullPage: true });
        passed++;
      }
      await page.locator('#game-paused-title + p + div a[href="/apps"]').click();
      await page.waitForURL(base + '/apps');
      await page.getByRole('heading', { name: t.catalogTitle, exact: true }).waitFor();
      assert.equal(await page.locator('nav a[aria-current="page"]').getAttribute('href'), '/apps');
      await page.goto(base + '/games');
      await page.locator('#game-paused-title + p + div a[href="/roblox"]').click();
      await page.waitForURL(base + '/roblox');
      await page.getByRole('heading', { name: c.robloxHeroTitle, exact: true }).waitFor();
      assert.equal(await page.locator('nav a[aria-current="page"]').getAttribute('href'), '/roblox');
      assert.equal(await page.locator('nav a[href^="/games"]').count(), 0);
      assert.deepEqual(errors, []);
      assert.deepEqual(unexpected, []);
      passed++;
      console.log(`PASS ${width} ${language}: Game routes, no API calls, keyboard and Apps/Roblox navigation`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
assert.equal(passed, 36);
console.log(`${passed} isolated browser scenarios PASS`);
