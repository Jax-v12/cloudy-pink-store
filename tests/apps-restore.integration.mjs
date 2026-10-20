import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { purgeRestoredAppsSecrets } from '../scripts/purge-restored-login-secrets.mjs';
const url = new URL(process.env.TEST_DATABASE_URL || 'invalid:');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname, '/cloudy_test_operations_empty_20261019');
const db = new PrismaClient({ datasourceUrl: url.href, log: [] });
const stamp = Date.now().toString();
try {
  const product = await db.product.create({ data: { name: 'Restore fixture', slug: 'restore-' + stamp, price: 1, type: 'APPS', active: false } });
  const create = (suffix, deliveredAt, status = 'PAID') => db.order.create({ data: { invoice: 'INV-restore-' + stamp + suffix, customerEmail: 'fixture@example.test', productId: product.id, totalAmount: 1, expiresAt: new Date(), status,
    appsService: { create: { deliveredAt, deliveryCiphertext: 'encrypted-fixture', reminderPhone: 'encrypted-fixture', reminderOptIn: true, reminderVerifiedAt: new Date() } } }, include: { appsService: true } });
  const recent = await create('recent', new Date());
  const expired = await create('expired', new Date(Date.now() - 73 * 3600_000));
  const unpaid = await create('unpaid', new Date(), 'PENDING');
  const result = await purgeRestoredAppsSecrets(db);
  assert.ok(result.deliveries >= 2 && result.contacts >= 3);
  for (const order of [recent, expired, unpaid]) {
    const s = await db.appsService.findUnique({ where: { orderId: order.id } });
    assert.equal(s.reminderPhone, null); assert.equal(s.reminderOptIn, false); assert.equal(s.reminderVerifiedAt, null);
    assert.equal(s.deliveredAt.toISOString(), order.appsService.deliveredAt.toISOString());
    assert.equal(s.deliveryCiphertext, order.id === recent.id ? 'encrypted-fixture' : null);
  }
  assert.deepEqual(await purgeRestoredAppsSecrets(db), { deliveries: 0, contacts: 0 });
  console.log(JSON.stringify({ restoreApps: 'PASS', fixtureOrders: 3, expiredAndUnpaidPurged: true, retainedTimestamps: true, reminderDispatchQuarantined: true, idempotent: true }));
} catch { console.error('APPS_RESTORE_TEST_FAILED'); process.exitCode = 1; }
finally { await db.$disconnect(); }
