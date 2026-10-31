import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TEST_RENDERER_URL || 'http://127.0.0.1:3188';
assert.equal(new URL(base).hostname, '127.0.0.1');
const output = '.cache/admin-operations-20261031/browser';
const selected = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let passed = 0;
async function toggleFrames(summary) {
  return summary.evaluate(async element=>{
    const details=element.parentElement,heights=[details.getBoundingClientRect().height];
    element.click();
    for(let i=0;i<24;i++) { await new Promise(requestAnimationFrame); heights.push(details.getBoundingClientRect().height); }
    return {supported:CSS.supports('interpolate-size','allow-keywords')&&CSS.supports('selector(::details-content)'),heights};
  });
}
try {
  for (const [width, height] of [[375,812], [810,1080], [1440,900]]) for (const locale of ['ID','EN','MY']) {
    if (selected && selected !== `${width} ${locale}`) continue;
    const context = await browser.newContext({ viewport: { width,height }, serviceWorkers: 'block' });
    await context.addInitScript(value => localStorage.setItem('store_lang',value),locale);
    const errors = [], mutations = [];
    let auth = 'ready';
    const row = (id, status, fulfillmentStatus, method, patch = {}) => ({
      id, invoice: `INV-OPS-${id}`, type: 'ROBLOX', status, fulfillmentStatus, refundStatus: 'NONE',
      productName: 'Fixture Roblox', variantName: method, units: 100, totalAmount: 15000,
      currency: 'IDR', pricingRegion: 'ID', owned: status === 'PAID', contactEmail: null, contactWhatsapp: null,
      archivedAt: null, removedFromAdminAt: null, canArchive: ['EXPIRED','CANCELLED'].includes(status), archiveReasonCodes: ['ORDER_NOT_FINAL'], canRemove: false, removeReasonCodes: [],
      robloxDetail: { method, username: 'FixtureUser', gamepassUrl: method === 'GAMEPASS' ? 'https://www.roblox.com/game-pass/123/Fixture' : null,
        gamepassPrice: method === 'GAMEPASS' ? 143 : null, gamepassVerifiedAt: null, robloxUserId: '42' },
      gameDetail: null, job: status === 'PAID' ? { evidence: null, attempts: [] } : null, audits: [], ...patch,
    });
    const rows = [row(1,'EXPIRED','NOT_READY','LOGIN'), row(2,'CANCELLED','NOT_READY','GAMEPASS'),
      row(3,'PENDING','NOT_READY','GIFT_USERNAME'), row(4,'PAID','PROCESSING','GAMEPASS'),
      row(5,'PAID','COMPLETED','GIFT_USERNAME'), row(6,'CANCELLED','REQUIRES_REVIEW','LOGIN',{refundStatus:'REQUIRED',canArchive:false}),
      row(7,'PAID','PROCESSING','GAMEPASS',{archivedAt:'2026-10-01T00:00:00.000Z'}), row(8,'PAID','NOT_READY','GIFT_USERNAME')];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) { errors.push('EXTERNAL_REQUEST'); return route.abort(); }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (request.method() !== 'GET') { mutations.push(url.pathname); return route.abort(); }
      if (url.pathname === '/api/admin/auth') return route.fulfill({ status: auth === 'ready' ? 200 : auth === 'denied' ? 401 : 503, json: { authenticated: auth === 'ready' } });
      if (url.pathname === '/api/admin/fulfillment') return route.fulfill({ json: { success:true, data:rows, pagination:{nextCursor:null}, monitoring:null } });
      if (['/api/admin/apps/products','/api/admin/apps/orders','/api/admin/stock','/api/admin/orders'].includes(url.pathname)) return route.fulfill({json:{success:true,data:[],pagination:{nextCursor:null}}});
      if (url.pathname === '/api/admin/analytics') return route.fulfill({json:{success:true,data:{totalRevenue:0,totalSold:0,chartData:[]}}});
      if (url.pathname === '/api/admin/metrics') return route.fulfill({json:{success:true,data:{observations:[],paid:[]}}});
      if (url.pathname === '/api/admin/apps/reminders') return route.fulfill({json:{success:true,data:[],pagination:{nextCursor:null}}});
      errors.push('UNEXPECTED_API'); return route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(10000); page.setDefaultNavigationTimeout(60000); page.on('pageerror',()=>errors.push('PAGE_ERROR'));
    const t=translations[locale],ops=t.robloxOps;
    try {
      await page.goto(base+'/admin/commerce');
      const card = id => page.locator('article').filter({has:page.getByRole('heading',{name:`INV-OPS-${id}`,exact:true})});
      await card(1).waitFor();
      for(const id of [1,2,3,5,7]) assert.equal(await card(id).locator('input').count(),0,`inactive order ${id} exposes evidence input`);
      for(const id of [1,2]) await card(id).getByText(ops.notStarted,{exact:true}).waitFor();
      assert.equal(await card(1).getByText(ops.loginNext,{exact:true}).count(),0);
      await card(8).getByText(t.commerce.REQUIRES_REVIEW,{exact:true}).waitFor();
      assert.equal(await card(4).getByRole('textbox',{name:t.commerce.evidence,exact:true}).count(),1);
      assert.equal(await card(6).getByRole('textbox',{name:t.commerce.evidence,exact:true}).count(),1);
      await card(4).getByRole('textbox',{name:t.commerce.evidence,exact:true}).fill('fixture-reference');
      await card(1).getByRole('button',{name:t.commerce.archive,exact:true}).click();
      const archiveDialog=page.getByRole('dialog',{name:t.commerce.archive,exact:true});
      await archiveDialog.getByText(t.commerce.archiveWarning,{exact:true}).waitFor();
      await archiveDialog.getByRole('button',{name:t.commerce.cancelAction,exact:true}).click();
      await page.screenshot({path:`${output}/${width}-${locale}-queue.png`,fullPage:true});
      await card(1).screenshot({path:`${output}/${width}-${locale}-expired.png`});
      await card(1).evaluate(el => window.scrollBy(0, el.getBoundingClientRect().top - (document.querySelector('header')?.getBoundingClientRect().height ?? 0) - 12));
      await page.screenshot({path:`${output}/${width}-${locale}-expired-viewport.png`});
      const trigger=page.getByRole('button',{name:t.adminGuide.title,exact:true});
      await trigger.click();
      const dialog=page.getByRole('dialog',{name:t.adminGuide.title,exact:true});
      await dialog.getByText(t.adminGuide.intro,{exact:true}).waitFor();
      await dialog.evaluate(async element=>{ await Promise.all(element.getAnimations().map(animation=>animation.finished)); });
      const guideBounds=await dialog.boundingBox();
      assert.equal(t.adminGuide.sections.length,5);
      const close=dialog.getByRole('button',{name:t.adminGuide.close,exact:true});
      await close.focus(); await page.keyboard.press('Tab');
      assert.equal(await dialog.locator('summary').first().evaluate(el=>el===document.activeElement),true);
      for(const section of t.adminGuide.sections) {
        const summary=dialog.locator('summary').filter({hasText:section.title});
        if(section===t.adminGuide.sections[0]) {
          const motion=await toggleFrames(summary);
          if(motion.supported)assert.ok(motion.heights.some(height=>height>motion.heights[0]+1 && height<motion.heights.at(-1)-1),'disclosure jumps straight to its expanded height');
          const collapse=await toggleFrames(summary);
          if(collapse.supported)assert.ok(collapse.heights.some(height=>height<collapse.heights[0]-1 && height>collapse.heights.at(-1)+1),'disclosure jumps straight to its collapsed height');
          await summary.click();
        } else await summary.click();
        await dialog.getByText(section.steps[0],{exact:true}).waitFor();
        await dialog.evaluate(async element=>{ await Promise.all(element.getAnimations({subtree:true}).map(animation=>animation.finished)); });
        const expandedBounds=await dialog.boundingBox();
        assert.ok(Math.abs(expandedBounds.height-guideBounds.height)<2,'guide size jumps when a section expands');
        assert.ok(Math.abs(expandedBounds.y-guideBounds.y)<2,'guide moves when a section expands');
      }
      await dialog.locator('summary').last().focus(); await page.keyboard.press('Tab');
      assert.equal(await close.evaluate(el=>el===document.activeElement),true);
      await page.screenshot({path:`${output}/${width}-${locale}-guide.png`});
      await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
      assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
      assert.equal(await card(4).getByRole('textbox',{name:t.commerce.evidence,exact:true}).inputValue(),'fixture-reference');
      await page.emulateMedia({reducedMotion:'reduce'});
      await trigger.click(); await dialog.getByText(t.adminGuide.intro,{exact:true}).waitFor();
      await dialog.locator('summary').first().click();
      assert.equal(await dialog.evaluate(element=>element.getAnimations({subtree:true}).every(animation=>Number(animation.effect.getTiming().duration)<=1)),true,'reduced motion still has a visible animation');
      await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
      await page.emulateMedia({reducedMotion:'no-preference'});
      auth='denied'; await trigger.click(); await dialog.getByText(t.commerce.UNAUTHORIZED,{exact:true}).waitFor();
      assert.equal(await dialog.getByText(t.adminGuide.intro,{exact:true}).count(),0); await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
      auth='failed'; await trigger.click(); await dialog.getByText(t.commerce.SYSTEM_ERROR,{exact:true}).waitFor();
      auth='ready'; await dialog.getByRole('button',{name:t.commerce.retryLoad,exact:true}).click();
      await dialog.getByText(t.adminGuide.intro,{exact:true}).waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({state:'hidden'});
      for(const path of ['/admin/apps','/admin']) {
        await page.goto(base+path); const button=page.getByRole('button',{name:t.adminGuide.title,exact:true}); await button.click();
        await page.getByRole('dialog',{name:t.adminGuide.title,exact:true}).getByText(t.adminGuide.intro,{exact:true}).waitFor();
        await page.keyboard.press('Escape');
        await page.getByRole('dialog',{name:t.adminGuide.title,exact:true}).waitFor({state:'hidden'});
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      assert.deepEqual(errors,[]); assert.deepEqual(mutations,[]);
      passed++; console.log(`PASS ${width} ${locale}: terminal orders, guide, auth denial/retry, keyboard and draft retention`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
assert.equal(passed,selected ? 1 : 9);
