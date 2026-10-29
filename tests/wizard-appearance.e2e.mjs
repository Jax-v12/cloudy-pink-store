// Local browser renderer and synthetic API fixtures only; no DB/provider/order writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3144';
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = path.resolve('.cache/wizard-polish-20261029/browser');
const filter = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const stepperStyles = new Map();

async function run(width, height, locale, scenario) {
  const name = `${width} ${locale} ${scenario}`;
  if (filter && !name.includes(filter)) return;
  const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
  const unexpected = [], errors = [];
  const t = translations[locale];
  await context.addInitScript(value => localStorage.setItem('store_lang', value), locale);
  const login = scenario.startsWith('LOGIN');
  const variants = scenario === 'LOGIN empty' ? [] : (scenario === 'LOGIN multiple' ? [160, 320, 480, 640] : [160])
    .map((units, index) => ({ id: index + 1, units, name: `${units} Robux`, price: units * 170,
      method: login ? 'LOGIN' : scenario, maxUnits: 1600, unitStep: 5 }));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { unexpected.push('external'); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (url.pathname === '/api/products') return route.fulfill({ json: { success: true,
      data: [{ id: 1, slug: 'fixture-wizard', name: 'Fixture Roblox', checkoutEnabled: scenario !== 'LOGIN unavailable', variants }],
      location: { region: 'ID' }, paymentMethods: [{ id: 'qris', label: 'QRIS' }], pagination: { nextCursor: null } } });
    if (url.pathname === '/api/checkout/session') return route.fulfill({ json: { success: true, data: { outcome: 'READY' } } });
    if (url.pathname === '/api/checkout/quote') return route.fulfill({ json: { success: true, data: {
      productSubtotal: 27200, paymentFee: 0, discount: 0, totalAmount: 27200, pricingRegion: 'ID', quoteToken: 'fixture-only',
    } } });
    unexpected.push(request.method() + ' ' + url.pathname);
    return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', () => errors.push('PAGE_ERROR'));
  try {
    await page.goto(`${base}/roblox/fixture-wizard?method=${login ? 'LOGIN' : scenario}`);
    const steps = page.locator('ol').filter({ has: page.locator('[aria-current=step]') });
    await steps.waitFor();
    const estimate = page.getByText(t.serviceHelp.comparison.estimates[login ? 'LOGIN' : scenario], { exact: true });
    await estimate.waitFor();
    assert.equal(await estimate.isVisible(), true, 'approved estimate is visible before checkout');
    assert.equal(await steps.locator(':scope > li').count(), login ? 3 : scenario === 'GAMEPASS' ? 5 : 4);
    assert.equal(await steps.locator('[aria-current=step]').count(), 1);
    const circle = steps.locator('li').first().locator('span.rounded-full');
    const appearance = await circle.evaluate(el => {
      const style = getComputedStyle(el);
      return [style.width, style.height, style.backgroundColor, style.color, style.borderRadius];
    });
    const key = `${width} ${locale}`;
    if (stepperStyles.has(key)) assert.deepEqual(appearance, stepperStyles.get(key), 'all methods share the same step indicator styling');
    else stepperStyles.set(key, appearance);

    if (!login) {
      assert.equal(await steps.locator('button').nth(1).isDisabled(), true, 'future steps stay blocked');
      assert.ok((await steps.locator('button').first().boundingBox()).height >= 44, 'step navigation touch target');
      const description = scenario === 'GAMEPASS' ? t.robloxFlow.description : t.usernameFlow.description;
      assert.equal(await page.getByText(description, { exact: true }).count(), 1, 'method description must appear once');
      const next = page.locator('form button[type=submit]');
      await next.click();
      await page.locator('input[name=username]').fill('FixtureUser');
      await page.locator('input[type=email]').fill('fixture@example.invalid');
      await steps.locator('button').first().click();
      assert.equal(await page.locator('form h2').evaluate(el => el === document.activeElement), true, 'back-step focus');
      await next.click();
      assert.equal(await page.locator('input[name=username]').inputValue(), 'FixtureUser', 'draft retained');
      assert.equal(await page.locator('input[type=email]').inputValue(), 'fixture@example.invalid');
      const form = await page.locator('form').boundingBox();
      assert.ok(Math.abs(form.x + form.width / 2 - width / 2) <= 2, 'wizard remains centered');
      await steps.locator('button').first().click();
    } else {
      if (scenario === 'LOGIN empty') {
        await page.getByText(t.roblox.noPackages, { exact: true }).waitFor();
        assert.equal(await page.locator('input[name=package]').count(), 0);
        assert.equal(await page.getByRole('button', { name: t.loginFlow.continue, exact: true }).isDisabled(), true);
      } else {
        const packages = page.locator('input[name=package]');
        await packages.first().waitFor({ state: 'attached' });
        assert.equal(await packages.count(), variants.length);
        const next = page.getByRole('button', { name: t.loginFlow.continue, exact: true });
        assert.equal(await next.isDisabled(), true, 'explicit selection is still required');
        if (scenario === 'LOGIN single') {
          assert.equal(await page.getByText(t.loginFlow.selectPackage, { exact: true }).isVisible(), true, 'explain disabled continue');
          assert.ok(await packages.first().evaluate(el => {
            const card = el.closest('label');
            return card.getBoundingClientRect().width / card.parentElement.getBoundingClientRect().width > 0.95;
          }), 'single package uses the available row width');
        }
        if (scenario !== 'LOGIN unavailable') {
          await packages.first().focus(); await page.keyboard.press('Space');
          await page.waitForFunction(name => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === name && !el.disabled), t.loginFlow.continue);
          assert.equal(await next.isEnabled(), true);
          if (scenario === 'LOGIN single') assert.equal(await page.getByText(t.loginFlow.selectPackage, { exact: true }).count(), 0);
        } else {
          await page.getByText(t.loginFlow.paymentUnavailable, { exact: true }).waitFor();
          await packages.first().focus(); await page.keyboard.press('Space');
          assert.equal(await next.isDisabled(), true, 'unavailable checkout stays blocked');
        }
        if (scenario === 'LOGIN multiple' && width >= 640) {
          const tops = await packages.evaluateAll(inputs => inputs.map(input => input.closest('label').getBoundingClientRect().top));
          assert.equal(tops[0], tops[2]); assert.ok(tops[3] > tops[2], 'multiple packages retain responsive grid');
        }
      }
      assert.equal(await steps.locator('button').count(), 0, 'Login step indicators do not bypass its guarded navigation');
    }
    await page.evaluate(async () => {
      scrollTo({ top: 0, left: 0, behavior: 'instant' });
      await document.fonts.ready;
      await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    assert.equal(await steps.locator(':scope > li').evaluateAll(items => items.some(item => {
      const text = item.querySelector('span.block')?.firstChild;
      if (!text) return false;
      return [...text.textContent.matchAll(/\S+/g)].some(word => {
        const range = document.createRange();
        range.setStart(text, word.index); range.setEnd(text, word.index + word[0].length);
        return new Set([...range.getClientRects()].map(rect => Math.round(rect.top))).size > 1;
      });
    })), false, 'step labels must wrap between words, not split words across lines');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no page overflow');
    assert.deepEqual(unexpected, [], 'no unexpected API/provider requests or order creation');
    assert.deepEqual(errors, [], 'no browser errors');
    await page.screenshot({ path: path.join(output, `${width}-${locale}-${scenario.replaceAll(' ', '-')}.png`), fullPage: true });
    results.push({ name, status: 'PASS' }); console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, status: 'FAIL', reason: error.message }); console.log('FAIL ' + name + ': ' + error.message.slice(0, 350));
  } finally { await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
}

try {
  for (const [width, height] of [[375, 812], [810, 1080], [1440, 900]]) for (const locale of ['ID', 'EN', 'MY']) {
    for (const scenario of ['GAMEPASS', 'GIFT_USERNAME', 'LOGIN single', 'LOGIN multiple', 'LOGIN unavailable', 'LOGIN empty']) {
      await run(width, height, locale, scenario);
    }
  }
} finally { await browser.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(results, null, 2)); }
console.log(JSON.stringify({ passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length }));
if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
