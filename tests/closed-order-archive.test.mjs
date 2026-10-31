import test from 'node:test';
import assert from 'node:assert/strict';
delete process.env.DATABASE_URL;
let row;
let audits=[];
globalThis.prisma={ $transaction:async fn=>fn({
  $queryRaw:async()=>[], order:{findUnique:async()=>({...row}),update:async({data})=>Object.assign(row,data)},
  adminAudit:{create:async({data})=>{audits.push(data);}},
}) };
const { archiveEligibility, removeEligibility }=await import('../src/lib/orderArchive.ts');
const { applyPaymentStatus }=await import('../src/lib/payments.ts');

const closed = { type:'ROBLOX', status:'EXPIRED', fulfillmentStatus:'NOT_READY', refundStatus:'NONE',
  archivedAt:null, removedFromAdminAt:null, job:null, secret:null, accountStock:null };
test('expired and cancelled unfulfilled top-ups can leave the active admin queue recoverably', () => {
  for(const type of ['ROBLOX','GAME']) for(const status of ['EXPIRED','CANCELLED']) {
    const row={...closed,type,status};
    assert.equal(archiveEligibility(row).canArchive,true);
    assert.equal(removeEligibility(row).canRemove,false,'removal still requires archive');
    assert.equal(removeEligibility({...row,archivedAt:new Date()}).canRemove,true);
  }
});
test('unpaid archive eligibility fails closed for unfinished obligations and inconsistent delivery', () => {
  for(const patch of [
    {status:'PENDING'},{status:'PAID'},{type:'APPS'}, {refundStatus:'REQUIRED'},{refundStatus:'COMPLETED'},
    ...['QUEUED','PROCESSING','WAITING_CUSTOMER','REQUIRES_REVIEW','COMPLETED'].map(fulfillmentStatus=>({fulfillmentStatus})),
    {secret:{orderId:1}}, ...['READY','LOCKED','SOLD'].map(status=>({accountStock:{status}})),
    {job:{completedAt:new Date(),leaseToken:null,leaseUntil:null}},
    {job:{completedAt:null,leaseToken:'fixture',leaseUntil:new Date(Date.now()+60000)}},
  ]) assert.equal(archiveEligibility({...closed,...patch}).canArchive,false);
});

const paid=()=>({provider:'MIDTRANS',invoice:row.invoice,amount:row.totalAmount,currency:'IDR',region:'ID',reference:'fixture-payment',state:'paid',cancelled:false,qr:null});
test('verified late payment reopens an archived/removed order exactly once for review without fulfilling', async()=>{
  for(const status of ['EXPIRED','CANCELLED']) {
    row={...closed,id:1,invoice:'INV-late-fixture',status,archivedAt:new Date(),removedFromAdminAt:new Date(),
      paymentProvider:'MIDTRANS',pricingRegion:'ID',currency:'IDR',totalAmount:1000,paymentReference:'fixture-payment'}; audits=[];
    assert.equal(await applyPaymentStatus(1,paid()),'review');
    assert.equal(row.status,'PAID'); assert.equal(row.fulfillmentStatus,'REQUIRES_REVIEW'); assert.equal(row.refundStatus,'REQUIRED');
    assert.equal(row.archivedAt,null); assert.equal(row.removedFromAdminAt,null); assert.equal(audits.length,1);
    assert.equal(await applyPaymentStatus(1,paid()),'unchanged'); assert.equal(audits.length,1);
  }
});
test('invalid or pending provider status cannot reopen hidden orders',async()=>{
  row={...closed,id:1,invoice:'INV-late-fixture',archivedAt:new Date(),removedFromAdminAt:null,
    paymentProvider:'MIDTRANS',pricingRegion:'ID',currency:'IDR',totalAmount:1000,paymentReference:'fixture-payment'};audits=[];
  await assert.rejects(applyPaymentStatus(1,{...paid(),amount:1001}),/PAYMENT_MISMATCH/);
  assert.ok(row.archivedAt); assert.equal(row.status,'EXPIRED');
  assert.equal(await applyPaymentStatus(1,{...paid(),state:'pending'}),'unchanged'); assert.ok(row.archivedAt); assert.equal(audits.length,0);
});
