import test from 'node:test';
import assert from 'node:assert/strict';
import { reminderWindows, reminderEligible, whatsappReady, sendWhatsappReminder } from '../src/lib/appsReminders.ts';

test('H-3 and H-1 use separate bounded windows and never send after expiry', () => {
  const end = new Date('2026-11-01T10:00:00Z');
  const windows = reminderWindows(end);
  assert.deepEqual(windows.map(w => w.daysBefore), [3, 1]);
  assert.equal(windows[0].dueAt.toISOString(), '2026-10-29T10:00:00.000Z');
  assert.equal(windows[0].expiresAt.toISOString(), '2026-10-30T10:00:00.000Z');
  const service = { reminderOptIn: true, reminderVerifiedAt: new Date(), reminderPhone: 'encrypted', activeUntil: end };
  const order = { type: 'APPS', status: 'PAID', refundStatus: 'NONE', fulfillmentStatus: 'COMPLETED', archivedAt: null, removedFromAdminAt: null };
  assert.equal(reminderEligible(order, service, windows[0], new Date('2026-10-29T10:00:00Z')), true);
  for (const at of ['2026-10-29T09:59:59Z', '2026-10-30T10:00:00Z', '2026-11-01T10:00:00Z']) assert.equal(reminderEligible(order, service, windows[0], new Date(at)), false);
  assert.equal(reminderEligible(order, { ...service, reminderVerifiedAt: null }, windows[0], windows[0].dueAt), false);
  assert.equal(reminderEligible({ ...order, refundStatus: 'REQUESTED' }, service, windows[0], windows[0].dueAt), false);
  assert.equal(reminderEligible(order, { ...service, activeUntil: new Date('2026-11-02T10:00:00Z') }, windows[0], windows[0].dueAt), false);
});

const env = { WHATSAPP_REMINDERS_ENABLED: 'true', WHATSAPP_ACCESS_TOKEN: 'synthetic-token', WHATSAPP_PHONE_NUMBER_ID: '123456', WHATSAPP_TEMPLATE_NAME: 'apps_expiry', WHATSAPP_GRAPH_VERSION: 'v99.0' };
test('WhatsApp remains disabled without complete operator configuration', () => {
  assert.equal(whatsappReady({}), false);
  assert.equal(whatsappReady(env), true);
  assert.equal(whatsappReady({ ...env, WHATSAPP_GRAPH_VERSION: '../evil' }), false);
});
test('adapter sends only approved template parameters; accepted is distinct from delivered and ambiguous responses never succeed', async () => {
  let call;
  const message = { phone: '+6281234567890', language: 'ID', daysBefore: 3, periodEnd: new Date('2026-11-01T10:00:00Z') };
  assert.equal(await sendWhatsappReminder(message, env, async (url, init) => { call = { url, init }; return Response.json({ messages: [{ id: 'wamid.synthetic' }] }); }), 'ACCEPTED');
  assert.equal(call.url, 'https://graph.facebook.com/v99.0/123456/messages');
  const body = JSON.parse(call.init.body);
  assert.equal(body.type, 'template'); assert.equal(body.template.language.code, 'id');
  assert.deepEqual(body.template.components[0].parameters.map(p => p.text), ['3', '2026-11-01']);
  assert.equal(call.init.redirect, 'error');
  assert.equal(await sendWhatsappReminder(message, env, async () => Response.json({ success: true })), 'UNKNOWN');
  assert.equal(await sendWhatsappReminder(message, env, async () => { throw new Error('timeout'); }), 'UNKNOWN');
  assert.equal(await sendWhatsappReminder(message, env, async () => Response.json({ error: { code: 100 } }, { status: 400 })), 'REJECTED');
  await assert.rejects(sendWhatsappReminder(message, {}, async () => { throw new Error('must not call'); }), /WHATSAPP_UNAVAILABLE/);
});
