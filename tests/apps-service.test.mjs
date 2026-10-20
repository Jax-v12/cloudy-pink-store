import test from 'node:test';
import assert from 'node:assert/strict';
process.env.ENCRYPTION_KEY = 'synthetic-apps-service-key';
let order, audit, sessionValid = true, recent = true, priorService = null;
const tx = {
  $queryRaw: async () => [],
  adminSession: { findUnique: async ({ where }) => sessionValid ? ({ id: where.id, expiresAt: new Date(Date.now() + 60000), reauthenticatedAt: recent ? new Date() : null }) : null },
  order: { findUnique: async () => structuredClone(order), update: async ({ data }) => Object.assign(order, data) },
  fulfillmentJob: { update: async ({ data }) => Object.assign(order.job, data) },
  appsService: { update: async ({ data }) => Object.assign(order.appsService, data), findUnique: async () => priorService },
  appsSupport: { upsert: async ({ create, update }) => { order.appsSupport = order.appsSupport ? { ...order.appsSupport, ...update } : create; return order.appsSupport; } },
  adminAudit: { create: async ({ data }) => { audit.push(data); } },
};
globalThis.prisma = { $transaction: async fn => fn(tx) };
const { appsOrderAction } = await import('../src/lib/appsService.ts');
const cfg = { version: 1, appGroup: 'video', accountType: 'Private', durationDays: 7, devices: 'one', regionRules: 'ID', usageRules: 'rules', included: 'access', instructions: 'guide', warrantyDays: 7, warrantyTerms: 'terms', fulfillmentMode: 'ACTIVATION', activationMethod: 'INVITATION' };
function reset() { sessionValid = true; recent = true; priorService = null; audit = []; order = { id: 1, type: 'APPS', status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: 'QUEUED', archivedAt: null, removedFromAdminAt: null, paidAt: new Date(), appsSnapshot: cfg, job: { ownerSessionId: null, completedAt: null }, appsService: { activeFrom: null, deliveredAt: null }, appsSupport: null }; }

test('activation requires a current owner and evidence; customer acknowledgment alone never completes it', async () => {
  reset();
  await assert.rejects(appsOrderAction(1, { action: 'complete', evidence: 'REF-1', sessionId: 'admin' }));
  await appsOrderAction(1, { action: 'claim', sessionId: 'admin' });
  assert.equal(order.fulfillmentStatus, 'PROCESSING');
  await assert.rejects(appsOrderAction(1, { action: 'deliver', sessionId: 'other', delivery: 'Invitation sent' }));
  await appsOrderAction(1, { action: 'deliver', sessionId: 'admin', delivery: 'Invitation sent' });
  await appsOrderAction(1, { action: 'acknowledge' });
  assert.equal(order.fulfillmentStatus, 'WAITING_CUSTOMER');
  assert.equal(order.appsService.activeFrom, null);
  await assert.rejects(appsOrderAction(1, { action: 'complete', sessionId: 'admin' }));
  await appsOrderAction(1, { action: 'complete', sessionId: 'admin', evidence: 'REF-1' });
  assert.equal(order.fulfillmentStatus, 'COMPLETED');
  assert.equal(order.appsService.activeUntil - order.appsService.activeFrom, 7 * 86400000);
  await assert.rejects(appsOrderAction(1, { action: 'complete', sessionId: 'admin', evidence: 'REF-2' }));
  assert.equal(audit.some(a => a.action.includes('Invitation')), false);
});

test('claims are invoice-bound, idempotent and do not mutate payment or stock', async () => {
  reset(); order.appsSnapshot = { ...cfg, fulfillmentMode: 'READY_ACCOUNT', activationMethod: null }; order.fulfillmentStatus = 'COMPLETED';
  await appsOrderAction(1, { action: 'support', reason: 'NO_ACCESS' });
  await appsOrderAction(1, { action: 'support', reason: 'NO_ACCESS' });
  assert.equal(order.appsSupport.status, 'OPEN');
  assert.equal(order.status, 'PAID');
  assert.equal(order.fulfillmentStatus, 'COMPLETED');
  await assert.rejects(appsOrderAction(1, { action: 'support', reason: 'password=secret' }));
  order.appsSupport.status = 'RESOLVED';
  await appsOrderAction(1, { action: 'support', reason: 'STOPPED_WORKING' });
  assert.equal(order.appsSupport.status, 'OPEN');
  assert.equal(order.appsSupport.reason, 'STOPPED_WORKING');
  order.refundStatus = 'COMPLETED';
  await assert.rejects(appsOrderAction(1, { action: 'support', reason: 'NO_ACCESS' }));
});

test('expired session and missing recent reauth cannot claim activation', async () => {
  reset(); sessionValid = false; await assert.rejects(appsOrderAction(1, { action: 'claim', sessionId: 'admin' }), /UNAUTHORIZED/);
  sessionValid = true; recent = false; await assert.rejects(appsOrderAction(1, { action: 'claim', sessionId: 'admin' }), /REAUTH_REQUIRED/);
  assert.equal(order.fulfillmentStatus, 'QUEUED');
});

test('owner can redeliver an uncompleted activation and renewal preserves the previous entitlement end', async () => {
  reset(); await appsOrderAction(1, { action: 'claim', sessionId: 'admin' });
  await appsOrderAction(1, { action: 'deliver', sessionId: 'admin', delivery: 'Invitation' });
  await appsOrderAction(1, { action: 'acknowledge' });
  await appsOrderAction(1, { action: 'deliver', sessionId: 'admin', delivery: 'Replacement invitation' });
  assert.equal(order.appsService.acknowledgedAt, null);
  const until = new Date(Date.now() + 3 * 86400000); priorService = { activeUntil: until }; order.appsService.renewalOfOrderId = 2;
  await appsOrderAction(1, { action: 'complete', sessionId: 'admin', evidence: 'REFERENCE' });
  assert.equal(order.appsService.activeFrom.getTime(), until.getTime());
  assert.equal(order.appsService.activeUntil.getTime(), until.getTime() + 7 * 86400000);
  assert.ok(order.appsService.activationConfirmedAt < order.appsService.activeFrom);
});
