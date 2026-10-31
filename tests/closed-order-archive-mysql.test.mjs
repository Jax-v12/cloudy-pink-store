import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const url=process.env.TEST_DATABASE_URL;
test('closed unpaid orders archive, restore and reopen on late payment using real MySQL locks', {skip:!url}, async t=>{
  const target=new URL(url); assert.ok(['127.0.0.1','localhost'].includes(target.hostname)&&/^\/cloudy_test_[a-z0-9_]+$/.test(target.pathname));
  process.env.DATABASE_URL=url;
  const {prisma}=await import('../src/lib/prisma.ts');
  const {setOrderArchived:archive,setOrderRemovedFromAdmin:remove}=await import('../src/lib/orderArchive.ts');
  const {applyPaymentStatus}=await import('../src/lib/payments.ts');
  const token=crypto.randomBytes(32).toString('base64url');
  const session=await prisma.adminSession.create({data:{tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+3600000),reauthenticatedAt:new Date()}});
  const product=await prisma.product.create({data:{name:'Closed order fixture',slug:crypto.randomUUID(),type:'ROBLOX',price:1000}});
  const fixture=(patch={})=>prisma.order.create({data:{productId:product.id,type:'ROBLOX',invoice:`INV-${crypto.randomUUID()}`,customerEmail:'fixture@example.test',totalAmount:1000,status:'EXPIRED',fulfillmentStatus:'NOT_READY',expiresAt:new Date(),...patch}});
  const paid=order=>({provider:'MIDTRANS',invoice:order.invoice,amount:1000,currency:'IDR',region:'ID',reference:`fixture-${order.id}`,state:'paid',cancelled:false,qr:null});
  const preserved=order=>Object.fromEntries(Object.entries(order).filter(([key])=>!['updatedAt','archivedAt','removedFromAdminAt'].includes(key)));
  try{
    await t.test('archive is idempotent and restore preserves expired financial history',async()=>{
      const order=await fixture(); assert.equal((await archive(order.id,session.id,true)).changed,true);
      assert.equal((await archive(order.id,session.id,true)).changed,false);
      assert.equal(await prisma.adminAudit.count({where:{orderId:order.id,action:'archive'}}),1);
      await archive(order.id,session.id,false);
      assert.deepEqual(preserved(await prisma.order.findUnique({where:{id:order.id}})),preserved(order));
    });
    await t.test('cancelled orders can be removed from archive and recovered without deletion',async()=>{
      const order=await fixture({status:'CANCELLED'}); await archive(order.id,session.id,true);
      await remove(order.id,session.id,true,order.invoice);
      assert.ok((await prisma.order.findUnique({where:{id:order.id}})).removedFromAdminAt);
      await remove(order.id,session.id,false); await archive(order.id,session.id,false);
      assert.deepEqual(preserved(await prisma.order.findUnique({where:{id:order.id}})),preserved(order));
    });
    await t.test('verified late payment reopens archived and removed orders once for refund review',async()=>{
      for(const removed of [false,true]){
        const order=await fixture();await archive(order.id,session.id,true);if(removed)await remove(order.id,session.id,true,order.invoice);
        assert.equal(await applyPaymentStatus(order.id,paid(order)),'review');
        const after=await prisma.order.findUnique({where:{id:order.id}});
        assert.equal(after.archivedAt,null);assert.equal(after.removedFromAdminAt,null);assert.equal(after.status,'PAID');assert.equal(after.refundStatus,'REQUIRED');assert.equal(after.fulfillmentStatus,'REQUIRES_REVIEW');
        assert.equal(await prisma.fulfillmentJob.count({where:{orderId:order.id}}),0);
        assert.equal(await applyPaymentStatus(order.id,paid(order)),'unchanged');
        assert.equal(await prisma.adminAudit.count({where:{orderId:order.id,action:'payment-reopened'}}),1);
      }
    });
    await t.test('remaining secrets and delivery jobs cannot be hidden',async()=>{
      for(const patch of [{secret:{create:{ciphertext:'encrypted-synthetic-fixture',expiresAt:new Date()}}},{job:{create:{completedAt:new Date()}}}]){
        const order=await fixture(patch);await assert.rejects(archive(order.id,session.id,true),/ORDER_HAS_OBLIGATIONS/);
        assert.equal((await prisma.order.findUnique({where:{id:order.id}})).archivedAt,null);
      }
    });
    await t.test('concurrent archive and verified settlement cannot hide money awaiting review',async()=>{
      const order=await fixture();const results=await Promise.allSettled([archive(order.id,session.id,true),applyPaymentStatus(order.id,paid(order))]);
      assert.equal(results[1].status,'fulfilled');
      if(results[0].status==='rejected')assert.match(results[0].reason.message,/ORDER_NOT_FINAL/);
      const after=await prisma.order.findUnique({where:{id:order.id}});assert.equal(after.archivedAt,null);assert.equal(after.removedFromAdminAt,null);assert.equal(after.refundStatus,'REQUIRED');assert.equal(after.totalAmount,1000);
    });
    await t.test('late payment audit failure rolls back payment and visibility changes together',async()=>{
      const order=await fixture();await archive(order.id,session.id,true);
      const before=await prisma.order.findUnique({where:{id:order.id}}),original=prisma.$transaction.bind(prisma);
      prisma.$transaction=(work,options)=>original(tx=>work(new Proxy(tx,{get(target,key){return key==='adminAudit'?{create:async()=>{throw Error('FIXTURE_AUDIT_FAILURE');}}:target[key];}})),options);
      try{await assert.rejects(applyPaymentStatus(order.id,paid(order)),/FIXTURE_AUDIT_FAILURE/);}finally{prisma.$transaction=original;}
      assert.deepEqual(await prisma.order.findUnique({where:{id:order.id}}),before);
    });
    if(process.env.TEST_BASE_URL)await t.test('HTTP archive removes expired order from active and keeps customer invoice recoverable',async()=>{
      const base=new URL(process.env.TEST_BASE_URL);assert.ok(['127.0.0.1','localhost'].includes(base.hostname));
      const order=await fixture(),headers={cookie:`admin_session_token=${token}`,origin:base.origin,'content-type':'application/json'};
      const list=async view=>{
        const response=await fetch(new URL('/api/admin/fulfillment?'+new URLSearchParams({type:'ROBLOX',q:order.invoice,archive:view}),base),{headers});
        assert.equal(response.status,200);return(await response.json()).data;
      };
      assert.equal((await list('active'))[0].canArchive,true);
      const change=archived=>fetch(new URL(`/api/admin/fulfillment/${order.id}/archive`,base),{method:'PATCH',headers,body:JSON.stringify({archived})});
      assert.equal((await change(true)).status,200);assert.equal((await list('active')).length,0);assert.equal((await list('archived'))[0].status,'EXPIRED');
      const invoice=await fetch(new URL(`/api/orders/${order.invoice}`,base),{headers:{'x-order-token':order.accessToken}});assert.equal(invoice.status,200);
      assert.equal((await change(false)).status,200);assert.equal((await list('active'))[0].id,order.id);
    });
  }finally{await prisma.$disconnect();}
});
