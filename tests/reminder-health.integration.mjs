import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const target = new URL(process.env.TEST_DATABASE_URL || 'invalid:');
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
assert.equal(target.pathname, '/cloudy_test_operations_empty_20261019');
process.env.DATABASE_URL = target.href; process.env.CRON_SECRET = 'synthetic-cron'; process.env.WHATSAPP_REMINDERS_ENABLED = 'false';
globalThis.fetch = async () => { throw Error('OUTBOUND_FORBIDDEN'); };
const { prisma } = await import('../src/lib/prisma.ts');
const { GET } = await import('../src/app/api/cron/reminders/route.ts');
let order, job;
try {
  assert.equal(await prisma.appsReminder.count({ where: { status: 'UNKNOWN' } }), 0);
  const product = await prisma.product.create({ data: { name: 'Synthetic health regression', slug: 'health-' + crypto.randomUUID(), price: 1000, type: 'APPS' } });
  order = await prisma.order.create({ data: { invoice: 'INV-HEALTH-' + crypto.randomUUID(), productId: product.id, totalAmount: 1000, type: 'APPS', customerEmail: 'fixture@example.test', expiresAt: new Date(), appsService: { create: {} } } });
  job = await prisma.appsReminder.create({ data: { orderId: order.id, daysBefore: 3, periodEnd: new Date(Date.now() + 3 * 86400000), dueAt: new Date(), expiresAt: new Date(Date.now() + 86400000), attemptedAt: new Date(), status: 'UNKNOWN' } });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await GET(new Request('https://fixture.example.test/api/cron/reminders', { headers: { authorization: 'Bearer synthetic-cron' } }));
    assert.equal(response.status, 503, 'fresh ambiguous outcome must survive immediate cron retry');
    assert.equal((await response.json()).success, false);
  }
  console.log('PASS fresh UNKNOWN remains failed across immediate cron retries with sending disabled');
} finally {
  if (job) await prisma.appsReminder.update({ where: { id: job.id }, data: { status: 'REVIEWED' } });
  if (order) await prisma.order.update({ where: { id: order.id }, data: { archivedAt: new Date() } });
  await prisma.$disconnect();
}
