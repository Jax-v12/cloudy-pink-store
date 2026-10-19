// Deployed renderer fixtures. All API writes and third-party traffic are intercepted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {appsTranslations} from '../src/lib/appsTranslations.ts';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/Jacob/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright');
const base=process.argv[2];if(!base||!/^https:\/\/cloudy-pink-store-[a-z0-9-]+\.vercel\.app$/.test(base))throw Error('PREVIEW_TARGET_REQUIRED');
const output='.cache/operations-20261019/browser';await fs.mkdir(output,{recursive:true});
const cfg={version:1,appGroup:'Fixture',accountType:'Private',durationDays:7,devices:'One device',regionRules:'ID',usageRules:'Fixture rules',included:'Fixture service',instructions:'Fixture guide',warrantyDays:7,warrantyTerms:'Fixture policy',fulfillmentMode:'ACTIVATION',activationMethod:'INVITATION'};
const order={invoice:'INV-SYNTHETIC-REMINDER',type:'APPS',status:'PAID',fulfillmentStatus:'COMPLETED',refundStatus:'NONE',product:{name:'Synthetic Apps service'},totalAmount:1000,currency:'IDR',pricingRegion:'ID',productSubtotal:1000,paymentFee:0,discount:0,units:1,paymentMethod:'QRIS',qrisUrl:null,qrisCode:null,account:null,otp:null,robloxDetail:null,gameDetail:null,isAuthorized:true,expiresAt:'2099-01-01',createdAt:new Date().toISOString(),paidAt:new Date().toISOString(),appsSnapshot:cfg,appsWarranty:{active:true,expiresAt:'2099-01-01',legacy:false,days:7},appsSupport:null};
const results=[],browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const[width,height]of[[375,812],[810,1080],[1440,900]])for(const locale of['ID','EN','MY']){
 const a=appsTranslations[locale],context=await browser.newContext({viewport:{width,height},serviceWorkers:'block'});
 await context.addInitScript(locale=>{localStorage.setItem('store_lang',locale);localStorage.setItem('token_INV-SYNTHETIC-REMINDER','synthetic-access-only')},locale);
 let opted=false,available=true,resolved=false,preferenceWrites=0,reviewWrites=0;const errors=[];const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());if(url.origin!==base)return route.abort();
 if(url.pathname==='/api/orders/INV-SYNTHETIC-REMINDER')return route.fulfill({json:{success:true,data:{...order,appsService:{deliveredAt:null,acknowledgedAt:null,activeFrom:new Date().toISOString(),activeUntil:'2099-01-01',delivery:null,reminderOptIn:opted,reminderVerified:false,remindersAvailable:available}}}});
 if(url.pathname==='/api/orders/INV-SYNTHETIC-REMINDER/reminders'){assert.equal(req.method(),'POST');const body=req.postDataJSON();assert.equal(req.headers()['x-order-token'],'synthetic-access-only');if(body.enabled){assert.equal(body.consent,true);assert.equal(body.phone,'+6281234567890');assert.equal(body.language,locale);}else assert.deepEqual(body,{enabled:false});preferenceWrites++;opted=body.enabled;return route.fulfill({json:{success:true}})}
 if(url.pathname==='/api/admin/apps/reminders'){if(req.method()==='POST'){assert.equal(req.postDataJSON().evidence,'FIXTURE-REVIEW');reviewWrites++;resolved=true;return route.fulfill({json:{success:true}})}return route.fulfill({json:{success:true,data:resolved?[]:[{id:1,orderId:123,daysBefore:3,periodEnd:'2099-01-01',status:'UNKNOWN',attemptedAt:'2020-01-01'}],pagination:{nextCursor:null}}})}
 if(['/api/admin/apps/orders','/api/admin/apps/products','/api/products'].includes(url.pathname))return route.fulfill({json:{success:true,data:[],pagination:{nextCursor:null}}});
 if(url.pathname==='/api/admin/metrics')return route.fulfill({json:{success:true,data:{observations:[],paid:[]}}});
 if(url.pathname==='/api/metrics')throw Error('METRICS_MUST_REMAIN_DISABLED_ON_SHARED_PREVIEW');
 if(url.pathname.startsWith('/api/')||!['GET','HEAD'].includes(req.method()))throw Error('UNEXPECTED_API_REQUEST');return route.continue();});
 try{
 await page.goto(base+'/order/INV-SYNTHETIC-REMINDER');await page.getByRole('heading',{name:a.reminders,exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:a.reminderEnable,exact:true}).isDisabled(),true);
 await page.getByLabel(a.reminderPhone,{exact:true}).fill('+6281234567890');await page.getByRole('checkbox',{name:a.reminderConsent,exact:true}).check();
 await page.getByRole('button',{name:a.reminderEnable,exact:true}).click();await page.getByText(a.reminderPending,{exact:true}).waitFor();assert.equal(preferenceWrites,1);
 assert.equal(await page.evaluate(()=>Object.values(localStorage).some(v=>v.includes('6281234567890'))),false);
 await page.getByRole('button',{name:a.reminderDisable,exact:true}).click();await page.getByLabel(a.reminderPhone,{exact:true}).waitFor();assert.equal(preferenceWrites,2);
 available=false;await page.reload();await page.getByText(a.reminderUnavailable,{exact:true}).waitFor();assert.equal(await page.getByLabel(a.reminderPhone,{exact:true}).count(),0);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${output}/${width}-${locale}-reminder.png`,fullPage:true});
 await page.goto(base+'/admin/apps');await page.getByRole('heading',{name:a.reminderReview,exact:true}).waitFor();await page.getByRole('button',{name:a.reminderResolve,exact:true}).click();await page.getByLabel(a.evidence,{exact:true}).fill('FIXTURE-REVIEW');await page.getByRole('button',{name:a.reminderResolve,exact:true}).last().click();
 await page.getByRole('heading',{name:a.metrics,exact:true}).waitFor();await page.getByText(a.paidCount,{exact:true}).waitFor();assert.equal(reviewWrites,1);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.screenshot({path:`${output}/${width}-${locale}-review.png`,fullPage:true});
 results.push({width,height,locale,status:'PASS',preferenceWrites,reviewWrites});
 }catch(e){results.push({width,height,locale,status:'FAIL',error:e.message});throw e}finally{await context.close()}
}}finally{await browser.close();await fs.writeFile(output+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results))}
