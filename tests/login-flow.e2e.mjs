// Isolated browser fixtures only. Every API and external request is intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || 'playwright');
const base = 'http://127.0.0.1:3136';
const output = path.resolve('.cache/login-qa/screenshots'); await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const viewports = [{ width:375,height:812 },{ width:810,height:1080 },{ width:1440,height:900 }];
async function run(name, fn) { try { await fn(); results.push({name,status:'PASS'}); console.log('PASS '+name); } catch(e) { results.push({name,status:'FAIL',reason:e.message}); console.log('FAIL '+name+': '+e.message.slice(0,300)); } }
async function fixture(viewport, {region='ID', locale='EN', mode='normal', payment=true}={}) {
  const context = await browser.newContext({viewport, serviceWorkers:'block'});
  await context.addInitScript(lang => localStorage.setItem('store_lang',lang),locale);
  const state={quotes:[],checkouts:[],errors:[],forbidden:[]};
  const prices={ID:7500,MY:2100,PH:12300};
  const variants=[{id:1,name:'Fixture 100',units:100,price:mode==='null'?null:prices[region],method:'LOGIN'}, {id:2,name:'Fixture 200',units:200,price:prices[region]*2,method:'LOGIN'}, {id:3,name:'Unavailable',units:300,price:null,method:'LOGIN'}, {id:4,name:'Gamepass',units:50,price:prices[region],method:'GAMEPASS',maxUnits:5000,unitStep:5}, {id:5,name:'Username',units:50,price:prices[region],method:'GIFT_USERNAME',maxUnits:5000,unitStep:5}].filter(v=>mode!=='empty'||v.method!=='LOGIN');
  const product={id:9001,slug:'qa-login',name:'Fixture Roblox',type:'ROBLOX',checkoutEnabled:payment,variants};
  await context.route('**/*',async route=>{
    const request=route.request(), url=new URL(request.url());
    if(url.origin!==base) {state.forbidden.push('external');return route.abort();}
    if(!url.pathname.startsWith('/api/'))return route.continue();
    if(url.pathname==='/api/products')return route.fulfill({json:{success:true,data:url.searchParams.get('type')==='ROBLOX'?[product]:[],location:{region},paymentMethods:payment?[{id:'QRIS',label:'QRIS'}]:[],pagination:{nextCursor:null}}});
    if(url.pathname==='/api/checkout/quote') {const body=request.postDataJSON();state.quotes.push(body);const variant=variants.find(v=>v.id===body.variantId);return route.fulfill({json:{success:true,data:{productSubtotal:variant.price,paymentFee:750,discount:0,totalAmount:variant.price+750,pricingRegion:region,quoteToken:'a'.repeat(64)}}});}
    if(url.pathname==='/api/checkout') {state.checkouts.push({body:request.postDataJSON(),key:request.headers()['idempotency-key']});return route.fulfill({status:503,json:{success:false,errorCode:'SYSTEM_ERROR'}});}
    if(url.pathname==='/api/roblox/user')return route.fulfill({json:{success:true,data:{id:42,name:'FixtureUser',displayName:'Fixture User',avatarUrl:null}}});
    state.forbidden.push(url.pathname);return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>state.errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource'))state.errors.push(m.text());});
  const picker='/roblox/qa-login?method=LOGIN';
  async function start(){await page.goto(base+picker);await page.locator('input[name=package]').first().waitFor({state:'attached'});}
  async function account(){await start();await page.locator('input[name=package]').first().check({force:true});await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL('**/login/account');}
  async function fill(){await page.locator('[name=username]').fill('FixtureUser');await page.locator('[name=phoneCountry]').selectOption('US');await page.locator('[name=whatsapp]').fill('2133734253');await page.locator('[name=email]').fill('fixture@example.invalid');}
  async function summary(){await account();await fill();await page.getByRole('button',{name:'Continue',exact:true}).click();await page.waitForURL('**/login/summary');await page.getByRole('button',{name:'Confirm order',exact:true}).waitFor();await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Confirm order'&&!b.disabled));}
  async function clean(){assert.deepEqual(state.errors,[]);assert.deepEqual(state.forbidden,[]);assert.equal(await page.locator('input[type=password]').count(),0);const storage=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage}}));assert.ok(!storage.includes('FixtureUser')&&!storage.includes('2133734253')&&!storage.includes('fixture@example.invalid')&&!storage.includes('quoteToken'));assert.ok(!page.url().includes('FixtureUser')&&!page.url().includes('2133734253'));}
  async function layout(){await page.evaluate(async()=>{await document.fonts.ready;const image=new Image();image.src='/bg-anya.jpg';await image.decode();});const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);await page.screenshot({path:path.join(output,`${viewport.width}-${region}-${mode}-${new URL(page.url()).pathname.split('/').at(-1)}.png`),fullPage:true});}
  return {context,page,state,start,account,fill,summary,clean,layout};
}
try {
  for(const viewport of viewports) {
    await run(`${viewport.width} three pages, validation, back, privacy and retry`,async()=>{const f=await fixture(viewport);try{
      await f.account();assert.equal(f.state.quotes.length,0);assert.equal(f.state.checkouts.length,0);assert.equal(await f.page.locator('aside').count(),0);
      await f.page.getByRole('button',{name:'Continue',exact:true}).click();assert.equal(await f.page.locator('form [role=alert]').count(),3);
      await f.fill();await f.layout();await f.page.getByRole('button',{name:'Continue',exact:true}).click();await f.page.waitForURL('**/login/summary');
      const confirm=f.page.getByRole('button',{name:'Confirm order',exact:true});await confirm.waitFor();await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Confirm order'&&!b.disabled));
      assert.equal(f.state.checkouts.length,0);assert.equal(f.state.quotes.at(-1).paymentMethod,'QRIS');await f.layout();
      await f.page.goBack();await f.page.locator('[name=email]').waitFor();assert.equal(await f.page.locator('[name=email]').inputValue(),'fixture@example.invalid');await f.page.goForward();await f.page.waitForURL('**/login/summary');await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Confirm order'&&!b.disabled));
      await f.page.getByRole('button',{name:'Back',exact:true}).click();await f.page.locator('[name=username]').waitFor();assert.equal(await f.page.locator('[name=whatsapp]').inputValue(),'2133734253');assert.equal(await f.page.locator('[name=email]').inputValue(),'fixture@example.invalid');
      await f.page.getByRole('button',{name:'Continue',exact:true}).click();await f.page.waitForURL('**/login/summary');await confirm.waitFor();await f.page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Confirm order'&&!b.disabled));
      const recover=f.page.getByRole('button',{name:'Recover previous request',exact:true});
      await confirm.click();await f.page.locator('main [role=alert]').waitFor();assert.equal(await confirm.isDisabled(),true);await recover.click();assert.equal(f.state.checkouts.length,2);assert.equal(f.state.checkouts[0].key,f.state.checkouts[1].key);assert.deepEqual(f.state.checkouts[0].body,f.state.checkouts[1].body);assert.equal(f.state.checkouts[0].body.details.whatsappE164,'+12133734253');assert.equal('pricingRegion' in f.state.checkouts[0].body,false);
      await f.page.getByRole('button',{name:'Back',exact:true}).click();await f.page.locator('[name=email]').fill('changed@example.invalid');await f.page.getByRole('button',{name:'Continue',exact:true}).click();await f.page.waitForURL('**/login/summary');await recover.waitFor();assert.equal(await confirm.isDisabled(),true);await recover.click();await f.page.locator('main [role=alert]').waitFor();assert.equal(f.state.checkouts.length,3);assert.equal(f.state.checkouts[2].key,f.state.checkouts[0].key);assert.deepEqual(f.state.checkouts[2].body,f.state.checkouts[0].body);
      await f.clean();await f.page.reload();await f.page.waitForURL('**?method=LOGIN');assert.equal(f.state.checkouts.length,3);
    }finally{await f.context.close();}});
    await run(`${viewport.width} direct entry and method regressions`,async()=>{const f=await fixture(viewport);try{
      for(const stage of ['account','summary']){await f.page.goto(base+'/roblox/qa-login/login/'+stage);await f.page.waitForURL('**?method=LOGIN');}
      for(const method of ['GAMEPASS','GIFT_USERNAME']){await f.page.goto(base+'/roblox/qa-login?method='+method);await f.page.locator('ol button').first().waitFor();assert.equal(await f.page.locator('ol button').count(),method==='GAMEPASS'?5:4);}
      await f.page.goto(base+'/apps');await f.page.locator('main').waitFor();await f.clean();assert.equal(f.state.checkouts.length,0);
    }finally{await f.context.close();}});
    for(const mode of ['empty','null'])await run(`${viewport.width} ${mode} unavailable`,async()=>{const f=await fixture(viewport,{mode});try{await f.page.goto(base+'/roblox/qa-login?method=LOGIN');await f.page.getByRole('button',{name:'Continue',exact:true}).waitFor();if(mode==='empty')assert.equal(await f.page.locator('input[name=package]').count(),0);else assert.equal(await f.page.locator('input[value="1"]').isDisabled(),true);assert.equal(await f.page.getByRole('button',{name:'Continue',exact:true}).isDisabled(),true);assert.equal(await f.page.locator('aside').count(),0);await f.layout();await f.clean();}finally{await f.context.close();}});
  }
  for(const region of ['ID','MY','PH'])await run(`${region} independent quote, foreign phone and null price`,async()=>{const f=await fixture(viewports[0],{region});try{await f.summary();assert.equal(f.state.quotes.at(-1).variantId,1);assert.ok((await f.page.locator('main').innerText()).includes({ID:'IDR',MY:'MYR',PH:'PHP'}[region]));await f.clean();assert.equal(f.state.checkouts.length,0);}finally{await f.context.close();}});
  for(const region of ['MY','PH'])await run(`${region} actual unavailable payment gate`,async()=>{const f=await fixture(viewports[0],{region,payment:false});try{await f.start();await f.page.locator('input[value="1"]').check({force:true});assert.equal(await f.page.getByRole('button',{name:'Continue',exact:true}).isDisabled(),true);assert.equal(f.state.quotes.length,0);await f.clean();}finally{await f.context.close();}});
  for(const locale of ['ID','MY'])await run(`${locale} translated picker`,async()=>{const f=await fixture(viewports[0],{locale});try{await f.start();assert.equal(await f.page.locator('h1').innerText(),locale==='ID'?'Pilih nominal Robux':'Pilih jumlah Robux');await f.clean();}finally{await f.context.close();}});
} finally {await browser.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify(results,null,2));}
console.log(JSON.stringify({PASS:results.filter(r=>r.status==='PASS').length,FAIL:results.filter(r=>r.status==='FAIL').length,SKIP:0}));
if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
