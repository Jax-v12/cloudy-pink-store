// Local renderer only. Every API and external request is intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3144';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const output = '.cache/review-fixes-20261030/admin';
await fs.mkdir(output, { recursive: true });
const results = [];
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
const t = translations.EN;
async function run(name, work, { viewport = { width: 1440, height: 900 }, locale = 'EN' } = {}) {
  if (selected && !name.includes(selected)) return;
  const context = await browser.newContext({ viewport, serviceWorkers: 'block' });
  await context.addInitScript(value => localStorage.setItem('store_lang', value), locale);
  const unexpected = [], errors = [], calls = [];
  let releaseSave, signalSaving;
  const saving = new Promise(resolve => { signalSaving = resolve; });
  const products = Array.from({ length: 51 }, (_, index) => ({ id: 51 - index, name: `Fixture product ${51 - index}`,
    slug: `fixture-${51 - index}`, price: 1000, category: 'Fixture', active: false, appsConfig: null, updatedAt: '2026-10-01T00:00:00.000Z', stockAvailable: 0 }));
  const catalog = { id: 100, name: 'Fixture Roblox', slug: 'fixture-roblox', type: 'ROBLOX', active: false,
    updatedAt: '2026-10-01T00:00:00.000Z', deletion: { allowed: false, reasonCodes: [] }, variants: [] };
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) { unexpected.push('external'); return route.abort(); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const json = data => route.fulfill({ json: { success: true, ...data } });
    if (url.pathname === '/api/admin/auth') return json({ authenticated: true });
    if (url.pathname === '/api/admin/apps/products') {
      const cursor = url.searchParams.get('cursor'); calls.push(cursor);
      const remaining = products.filter(product => !cursor || product.id < Number(cursor));
      const data = remaining.slice(0, 50);
      return json({ data, pagination: { nextCursor: remaining.length > 50 ? data.at(-1).id : null } });
    }
    if (url.pathname === '/api/admin/stock') return json({ data: [], pagination: { nextCursor: null } });
    if (url.pathname === '/api/admin/orders') return json({ data: [], pagination: { nextCursor: null } });
    if (url.pathname === '/api/admin/analytics') return json({ data: { totalRevenue: 0, totalSold: 0, chartData: [] } });
    if (url.pathname === '/api/admin/fulfillment') return json({ data: [], pagination: { nextCursor: null }, monitoring: { overdue: false, lastRun: null, pendingCount: 0, reviewCount: 0 } });
    if (url.pathname === '/api/admin/catalog' && req.method() === 'GET') return json({ data: [catalog], pagination: { nextCursor: null }, paymentMethods: { ID: [], MY: [], PH: [] } });
    if (url.pathname === '/api/admin/catalog' && req.method() === 'POST') {
      await new Promise(resolve => { releaseSave = resolve; signalSaving(); });
      return route.fulfill({ status: 400, json: { success: false, errorCode: 'INVALID_INPUT' } });
    }
    unexpected.push(req.method() + ' ' + url.pathname); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(5000);
  page.on('pageerror', () => errors.push('PAGE_ERROR'));
  const insertProducts = () => products.unshift(...Array.from({ length: 70 }, (_, index) => ({ ...products[0], id: 121 - index, name: `New fixture ${121 - index}`, slug: `new-fixture-${121 - index}` })));
  try { await work({ page, calls, insertProducts, saving, release: () => releaseSave?.() }); assert.deepEqual(unexpected, []); assert.deepEqual(errors, []); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); }
  catch (error) { results.push({ name, status: 'FAIL' }); console.log('FAIL ' + name + ': ' + error.message.slice(0, 300)); }
  finally { releaseSave?.(); await context.unrouteAll({ behavior: 'wait' }); await context.close(); }
}
try {
  await run('product pagination reaches both stock selectors and retains selection on refresh', async ({ page, calls, insertProducts }) => {
    await page.goto(base + '/admin');
    await page.getByRole('tab', { name: t.tabProducts, exact: true }).click();
    await page.getByText('Fixture product 51', { exact: true }).waitFor();
    await page.getByRole('button', { name: t.loadMore, exact: true }).click();
    await page.getByText('Fixture product 1', { exact: true }).waitFor();
    assert.deepEqual(calls, [null, '2'], 'one explicitly requested page at a time');
    await page.getByRole('tab', { name: t.tabSingle, exact: true }).click();
    await page.locator('#single-product-select').selectOption('1');
    const form = page.locator('form').filter({ has: page.locator('#single-product-select') });
    await form.locator('input[type=text]').nth(0).fill('fixture@example.invalid');
    await form.locator('input[type=text]').nth(1).fill('synthetic-only');
    const refreshed = page.waitForResponse(response => response.url().includes('/api/admin/apps/products?cursor=2'));
    await page.getByRole('button', { name: t.btnSaveStock, exact: true }).click();
    await refreshed;
    await page.waitForFunction(() => document.querySelector('#single-product-select')?.value === '1' && document.querySelector('#single-product-select')?.options.length === 51);
    assert.deepEqual(calls, [null, '2', null, '2'], 'refresh rebuilds only the loaded depth');
    insertProducts();
    await form.locator('input[type=text]').nth(0).fill('fixture@example.invalid');
    await form.locator('input[type=text]').nth(1).fill('synthetic-only');
    const insertedRefresh = page.waitForResponse(response => response.url().includes('/api/admin/apps/products?cursor=72'));
    await page.getByRole('button', { name: t.btnSaveStock, exact: true }).click(); await insertedRefresh;
    await page.waitForFunction(() => document.querySelector('#single-product-select')?.value === '1' && document.querySelector('#single-product-select')?.options.length === 101);
    assert.deepEqual(calls, [null, '2', null, '2', null, '72'], 'inserts rebuild cursors without loading the whole catalog');
    await page.getByRole('tab', { name: t.tabBatch, exact: true }).click();
    assert.equal(await page.locator('#batch-product-select').inputValue(), '1');
    assert.equal(await page.locator('#batch-product-select option').count(), 101);
  });
  for (const viewport of [{ width: 375, height: 812 }, { width: 810, height: 1080 }, { width: 1440, height: 900 }]) for (const locale of ['ID', 'EN', 'MY']) await run(`${viewport.width} ${locale} variant editor focus, failed input and busy close`, async ({ page, saving, release }) => {
    const c = translations[locale].commerce;
    await page.goto(base + '/admin/commerce');
    await page.getByRole('button', { name: c.catalogAdmin, exact: true }).click();
    const trigger = page.getByRole('button', { name: '+ ' + c.newVariant, exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog'); await dialog.waitFor();
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    const name = dialog.getByRole('textbox', { name: c.name, exact: true });
    await name.fill('Retained fixture name');
    await dialog.locator('input[name=price]').fill('1000');
    const save = dialog.getByRole('button', { name: c.save, exact: true });
    await save.focus(); await page.keyboard.press('Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await save.click(); await saving;
    assert.equal(await dialog.getByRole('button', { name: c.closeEditor, exact: true }).isDisabled(), true);
    assert.equal(await dialog.getByRole('button', { name: c.cancelAction, exact: true }).isDisabled(), true);
    await page.keyboard.press('Escape'); assert.equal(await dialog.count(), 1, 'busy editor remains open');
    release();
    await dialog.getByRole('alert').waitFor();
    assert.equal(await name.inputValue(), 'Retained fixture name');
    assert.equal(await dialog.getByRole('alert').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 1, 'dialog stays inside the viewport');
    await page.screenshot({ path: `${output}/${viewport.width}-${locale}-variant-error.png` });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
  }, { viewport, locale });
} finally { await browser.close(); }
console.log(JSON.stringify({ passed: results.filter(row => row.status === 'PASS').length, failed: results.filter(row => row.status === 'FAIL').length }));
if (!results.length || results.some(row => row.status === 'FAIL')) process.exitCode = 1;
