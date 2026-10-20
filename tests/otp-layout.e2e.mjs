// Renderer-only fixtures: API mutations are intercepted; no customer/provider calls.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { translations } from '../src/lib/translations.ts';
const { chromium } = createRequire(import.meta.url)('C:/Users/Jacob/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const base = process.argv[2];
assert.match(base || '', /^https:\/\/cloudy-pink-store-[a-z0-9-]+\.vercel\.app$/);
const dir = '.cache/operations-20261020/browser'; await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true }), results = [];
try {
  for (const [width,height] of [[375,812],[810,1080],[1440,900]]) for (const language of ['ID','EN','MY']) {
    const context = await browser.newContext({ viewport: { width,height }, serviceWorkers:'block' });
    await context.addInitScript(language => { localStorage.setItem('store_lang', language); localStorage.setItem('token_INV-SYNTHETIC-OTP-QA','synthetic-only'); window.__shifts = []; new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shifts.push(e.value); }).observe({ type:'layout-shift', buffered:true }); }, language);
    const page = await context.newPage(); let posts = 0, writes = 0;
    await context.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.origin !== base) return route.abort();
      if (url.pathname === '/api/products') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return route.fulfill({ json:{success:true,data:[{id:1,name:'Fixture Roblox',slug:'fixture-roblox',checkoutEnabled:true,variants:[{id:1,name:'Fixture',price:1000,units:100,method:'GAMEPASS'},{id:2,name:'Fixture',price:1000,units:100,method:'GIFT_USERNAME'},{id:3,name:'Fixture',price:1000,units:100,method:'LOGIN'}]}],location:{region:'ID'},paymentMethods:[],pagination:{nextCursor:null}} });
      }
      if (url.pathname === '/api/orders/INV-SYNTHETIC-OTP-QA/otp') { posts++; assert.equal(req.method(),'POST'); return route.fulfill({json:{success:true,data:{status:'REQUESTED',requestId:7,code:null,updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}}}); }
      if (url.pathname === '/api/orders/INV-SYNTHETIC-OTP-QA') return route.fulfill({json:{success:true,data:{invoice:'INV-SYNTHETIC-OTP-QA',type:'APPS',status:'PAID',fulfillmentStatus:'COMPLETED',refundStatus:'NONE',product:{name:'Synthetic Apps QA'},totalAmount:1000,currency:'IDR',pricingRegion:'ID',units:1,productSubtotal:1000,paymentFee:0,discount:0,paymentMethod:'QRIS',qrisUrl:null,qrisCode:null,isAuthorized:true,account:{emailAccount:'fixture@example.test',passwordAccount:'synthetic-only',profileName:null,pin:null,additionalInfo:null},otp:{status:'REQUESTED',requestId:7,code:null,updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()},createdAt:new Date().toISOString(),paidAt:new Date().toISOString(),expiresAt:'2099-01-01',appsSnapshot:null,appsService:null,appsSupport:null,robloxDetail:null,gameDetail:null}}});
      if (!['GET','HEAD'].includes(req.method())) { writes++; return route.abort(); }
      if (url.pathname.startsWith('/api/')) return route.abort();
      return route.continue({headers:{...req.headers(),...(process.env.VERCEL_OIDC_TOKEN?{'x-vercel-trusted-oidc-idp-token':process.env.VERCEL_OIDC_TOKEN}:{})}});
    });
    await page.goto(base+'/roblox',{waitUntil:'networkidle'});
    const cls = await page.evaluate(() => window.__shifts.reduce((a,b) => a+b,0));
    assert.ok(cls < 0.1, `CLS ${cls} at ${width}/${language}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.screenshot({path:`${dir}/roblox-${language}-${width}.png`,fullPage:true});
    await page.goto(base+'/order/INV-SYNTHETIC-OTP-QA',{waitUntil:'networkidle'});
    const button = page.getByRole('button',{name:translations[language].btnRetryOtpNotification,exact:true});
    await button.waitFor({state:'visible'}); assert.equal(await button.isEnabled(),true);
    const reply = page.waitForResponse(response => response.url().endsWith('/api/orders/INV-SYNTHETIC-OTP-QA/otp'));
    await button.focus(); await page.keyboard.press('Enter'); await reply;
    assert.equal(posts,1); assert.equal(writes,0);
    await page.screenshot({path:`${dir}/otp-${language}-${width}.png`,fullPage:true});
    results.push({width,height,language,cls:Number(cls.toFixed(4)),otpRetryKeyboard:true,fixturePosts:posts,remoteWrites:0});
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(`${dir}/otp-layout-results.json`,JSON.stringify(results,null,2)); }
console.log(JSON.stringify({PASS:results.length,FAIL:0,remoteWrites:0,results}));
