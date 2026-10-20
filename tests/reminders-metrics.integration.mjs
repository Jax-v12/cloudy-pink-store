// Explicit disposable localhost target; all external requests are synthetic.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'next/headers' || specifier === 'next/headers.js') return { url: 'data:text/javascript,export async function cookies(){return {get(){return undefined}}}', shortCircuit: true };
  return next(specifier, context);
} });
const target = new URL(process.env.TEST_DATABASE_URL || 'invalid:');
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
assert.equal(target.pathname, '/cloudy_test_benchmark_20261019');
process.env.DATABASE_URL = target.href;
process.env.ENCRYPTION_KEY = 'synthetic-reminder-encryption';
process.env.CHECKOUT_HASH_KEY = 'synthetic-reminder-hmac';
Object.assign(process.env, { WHATSAPP_REMINDERS_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: '123456', WHATSAPP_TEMPLATE_NAME: 'apps_expiry', WHATSAPP_GRAPH_VERSION: 'v99.0', AGGREGATE_METRICS_ENABLED: 'true', APP_ORIGIN: 'https://fixture.example.test' });
const { prisma } = await import('../src/lib/prisma.ts');
const { setAppsReminder, adminAppsReminder, runAppsReminders, purgeAppsReminderContacts } = await import('../src/lib/appsReminders.ts');
const metrics = await import('../src/app/api/metrics/route.ts');
const reviews = await import('../src/app/api/admin/apps/reminders/route.ts');
const cron = await import('../src/app/api/cron/reminders/route.ts');
let sends = 0, timeout = false, passed = 0;
globalThis.fetch = async url => { assert.equal(url, 'https://graph.facebook.com/v99.0/123456/messages'); sends++; if (timeout) throw Error('SYNTHETIC_TIMEOUT'); await new Promise(r => setTimeout(r, 15)); return Response.json({ messages: [{ id: 'wamid.synthetic' }] }); };
const check = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name); };
let product, session, one, two;
const token = crypto.randomBytes(32).toString('base64url');
const make = async () => prisma.order.create({ data: { invoice: 'INV-REMINDER-' + crypto.randomUUID(), customerEmail: 'fixture@example.test', type: 'APPS', productId: product.id, totalAmount: 1000, status: 'PAID', fulfillmentStatus: 'COMPLETED', expiresAt: new Date(), paidAt: new Date(), appsService: { create: { activeFrom: new Date(Date.now() - 4 * 86400000), activeUntil: new Date(Date.now() + 3 * 86400000 - 3600000) } } } });
const consent = async id => setAppsReminder(id, { enabled: true, phone: '+6281234567890', language: 'ID', consent: true });
const verify = async id => { const contact = await adminAppsReminder(id, session.id, 'reminder-contact'); assert.equal(contact.recipientPhone, '+6281234567890'); await adminAppsReminder(id, session.id, 'reminder-verify', 'SYNTHETIC-OWNERSHIP', contact.consentAt); };
try {
  product = await prisma.product.create({ data: { name: 'Synthetic reminder', slug: 'reminder-' + crypto.randomUUID(), price: 1000, type: 'APPS' } });
  session = await prisma.adminSession.create({ data: { tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3600000), reauthenticatedAt: new Date() } });
  one = await make();
  await check('consent is explicit, encrypted and never eligible before admin verification', async () => {
    await assert.rejects(setAppsReminder(one.id, { enabled: true, phone: '+6281234567890', language: 'ID', consent: false }));
    await consent(one.id); const s = await prisma.appsService.findUnique({ where: { orderId: one.id } });
    assert.ok(s.reminderPhone && !s.reminderPhone.includes('6281234567890')); assert.equal(s.reminderVerifiedAt, null);
    await runAppsReminders(); assert.equal(sends, 0);
  });
  await check('verification rechecks the session and exact consent version under the lock', async () => {
    await assert.rejects(adminAppsReminder(one.id, 'missing-session', 'reminder-contact'));
    await assert.rejects(adminAppsReminder(one.id, session.id, 'reminder-verify', 'REF', new Date(0).toISOString()));
    await verify(one.id);
  });
  await check('concurrent cron calls send H-3 once and accepted never claims delivery', async () => {
    await Promise.all([runAppsReminders(), runAppsReminders()]); assert.equal(sends, 1);
    const jobs = await prisma.appsReminder.findMany({ where: { orderId: one.id } }); assert.equal(jobs.length, 1); assert.equal(jobs[0].status, 'ACCEPTED'); assert.equal(jobs[0].daysBefore, 3);
    await runAppsReminders(); assert.equal(sends, 1);
  });
  await check('opt-out deletes the recipient; reconsent cannot replay an attempted reminder', async () => {
    await setAppsReminder(one.id, { enabled: false }); assert.equal((await prisma.appsService.findUnique({ where: { orderId: one.id } })).reminderPhone, null);
    await consent(one.id); await verify(one.id); await runAppsReminders(); assert.equal(sends, 1);
  });
  await check('ambiguous provider outcomes are durable UNKNOWN and are never automatically replayed', async () => {
    two = await make(); await consent(two.id); await verify(two.id); timeout = true;
    await runAppsReminders(); await runAppsReminders(); assert.equal(sends, 2);
    assert.equal((await prisma.appsReminder.findFirst({ where: { orderId: two.id } })).status, 'UNKNOWN'); timeout = false;
  });
  await check('cron surfaces durable uncertainty and admin review is authorized without resending', async () => {
    process.env.CRON_SECRET = 'synthetic-cron-secret';
    const job = await prisma.appsReminder.findFirst({ where: { orderId: two.id } });
    await prisma.appsReminder.update({ where: { id: job.id }, data: { attemptedAt: new Date(Date.now() - 70000) } });
    const result = await cron.GET(new Request('https://fixture.example.test/api/cron/reminders', { headers: { authorization: 'Bearer synthetic-cron-secret' } }));
    assert.equal(result.status, 503); assert.equal((await result.json()).success, false);
    const req = auth => new Request('https://fixture.example.test/api/admin/apps/reminders', { method: 'POST', headers: { ...(auth ? { authorization: 'Bearer ' + token } : {}), 'content-type': 'application/json' }, body: JSON.stringify({ id: job.id, orderId: two.id, evidence: 'SYNTHETIC-REVIEW' }) });
    assert.equal((await reviews.POST(req(false))).status, 401);
    assert.equal((await reviews.POST(req(true))).status, 200);
    assert.equal((await prisma.appsReminder.findUnique({ where: { id: job.id } })).status, 'REVIEWED');
    await runAppsReminders(); assert.equal(sends, 2);
  });
  await check('refund suppresses sending and physically purges the recipient', async () => {
    await prisma.order.update({ where: { id: two.id }, data: { refundStatus: 'COMPLETED' } });
    await purgeAppsReminderContacts(); assert.equal((await prisma.appsService.findUnique({ where: { orderId: two.id } })).reminderPhone, null);
    await runAppsReminders(); assert.equal(sends, 2);
    await prisma.appsService.update({ where: { orderId: one.id }, data: { activeUntil: new Date(0) } });
    await purgeAppsReminderContacts(); assert.equal((await prisma.appsService.findUnique({ where: { orderId: one.id } })).reminderPhone, null);
  });
  await check('public measurements reject foreign origins, private fields and paid-status forgery', async () => {
    const req = (body, origin = 'https://fixture.example.test') => new Request('https://fixture.example.test/api/metrics', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const event = { area: 'APPS', metric: 'VIEW', bucket: 'COUNT' };
    assert.equal((await metrics.POST(req(event, 'https://other.example.test'))).status, 403);
    assert.equal((await metrics.POST(req({ ...event, email: 'fixture@example.test' }))).status, 400);
    assert.equal((await metrics.POST(req({ ...event, metric: 'PAID' }))).status, 400);
    const before = await prisma.aggregateMetric.aggregate({ where: { area: 'APPS', metric: 'VIEW' }, _sum: { count: true } });
    assert.equal((await metrics.POST(req(event))).status, 204);
    const after = await prisma.aggregateMetric.aggregate({ where: { area: 'APPS', metric: 'VIEW' }, _sum: { count: true } }); assert.equal(after._sum.count, (before._sum.count || 0) + 1);
  });
  console.log(JSON.stringify({ passed, provider: 'SYNTHETIC_ONLY', database: target.pathname.slice(1) }));
} finally {
  if (product) await prisma.product.update({ where: { id: product.id }, data: { active: false } });
  if (one || two) await prisma.order.updateMany({ where: { id: { in: [one?.id, two?.id].filter(Boolean) } }, data: { archivedAt: new Date() } });
  await prisma.$disconnect();
}
