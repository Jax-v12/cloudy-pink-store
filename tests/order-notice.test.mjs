import test from 'node:test';
import assert from 'node:assert/strict';
import { orderNotice, orderProgress, showFulfillmentDetails, formatQrCountdown } from '../src/lib/orderNotice.ts';
import { invoiceStatusTranslations } from '../src/lib/invoiceStatusTranslations.ts';
import { translations } from '../src/lib/translations.ts';

const paid = { type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'QUEUED', refundStatus: 'NONE', account: null, qrisUrl: null };
test('invoice progress follows verified payment and delivery independently', () => {
  for (const type of ['ROBLOX', 'GAME']) {
    const order = { ...paid, type };
    assert.deepEqual(orderProgress({ ...order, status: 'PENDING', fulfillmentStatus: 'COMPLETED' }), { stage: 'payment', message: 'pending' });
    assert.deepEqual(orderProgress(order), { stage: 'queued', message: 'queued' });
    assert.deepEqual(orderProgress({ ...order, fulfillmentStatus: 'PROCESSING' }), { stage: 'processing', message: 'processing' });
    assert.deepEqual(orderProgress({ ...order, fulfillmentStatus: 'COMPLETED' }), { stage: 'completed', message: 'completed' });
    assert.deepEqual(orderProgress({ ...order, fulfillmentStatus: 'WAITING_CUSTOMER' }), { stage: 'processing', message: 'waitingCustomer' });
    for (const fulfillmentStatus of ['NOT_READY', 'REQUIRES_REVIEW']) {
      assert.deepEqual(orderProgress({ ...order, fulfillmentStatus }), { stage: null, message: 'review' });
    }
  }
});

test('Apps progress is complete only when paid account delivery is available', () => {
  assert.deepEqual(orderProgress({ ...paid, type: 'APPS', fulfillmentStatus: 'COMPLETED' }), { stage: 'processing', message: 'preparing' });
  assert.deepEqual(orderProgress({ ...paid, type: 'APPS', account: {} }), { stage: 'completed', message: 'accountReady' });
  assert.deepEqual(orderProgress({ ...paid, type: 'APPS', status: 'PENDING', account: {} }), { stage: 'payment', message: 'pending' });
  assert.deepEqual(orderProgress({ ...paid, type: 'APPS', fulfillmentStatus: 'REQUIRES_REVIEW', account: {} }), { stage: null, message: 'review' });
});

test('closed and refund states cannot show a successful delivery timeline', () => {
  for (const type of ['APPS', 'ROBLOX', 'GAME']) {
    const order = { ...paid, type, account: {}, fulfillmentStatus: 'COMPLETED' };
    assert.deepEqual(orderProgress({ ...order, status: 'EXPIRED' }), { stage: null, message: 'expired' });
    assert.deepEqual(orderProgress({ ...order, status: 'CANCELLED' }), { stage: null, message: 'cancelled' });
    for (const status of ['PENDING', 'PAID', 'EXPIRED', 'CANCELLED']) {
      assert.deepEqual(orderProgress({ ...order, status, refundStatus: 'REQUIRED' }), { stage: null, message: 'refundRequired' });
      assert.deepEqual(orderProgress({ ...order, status, refundStatus: 'COMPLETED' }), { stage: null, message: 'refundCompleted' });
    }
  }
});
test('paid top-ups never report a payment problem because they have no Apps account', () => {
  const expected = { NOT_READY: 'review', QUEUED: 'queued', PROCESSING: 'processing', WAITING_CUSTOMER: 'waitingCustomer', COMPLETED: 'completed', REQUIRES_REVIEW: 'review' };
  for (const type of ['ROBLOX', 'GAME']) for (const [fulfillmentStatus, notice] of Object.entries(expected)) {
    for (const qrisUrl of [null, 'https://example.test/qr.png']) assert.equal(orderNotice({ ...paid, type, fulfillmentStatus, qrisUrl }), notice);
    for (const language of ['ID', 'EN', 'MY']) assert.ok(invoiceStatusTranslations[language][notice]);
  }
});
test('pending QRIS and paid Apps keep separate recovery messages', () => {
  assert.equal(orderNotice({ ...paid, status: 'PENDING' }), 'paymentPending');
  assert.equal(orderNotice({ ...paid, status: 'PENDING', qrisUrl: 'https://example.test/qr.png' }), null);
  assert.equal(orderNotice({ ...paid, type: 'APPS', fulfillmentStatus: 'COMPLETED', account: {} }), null);
  assert.equal(orderNotice({ ...paid, type: 'APPS', fulfillmentStatus: 'COMPLETED' }), 'accountReview');
  for (const status of ['EXPIRED', 'CANCELLED']) assert.equal(orderNotice({ ...paid, status }), null);
});
test('refund notices take precedence over normal delivery messages', () => {
  for (const fulfillmentStatus of ['QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'COMPLETED', 'REQUIRES_REVIEW']) {
    assert.equal(orderNotice({ ...paid, fulfillmentStatus, refundStatus: 'REQUIRED' }), 'refundRequired');
    assert.equal(orderNotice({ ...paid, fulfillmentStatus, refundStatus: 'COMPLETED' }), 'refundCompleted');
  }
});
test('fulfillment details are deferred until post-payment or refund, and QR countdown formats 2-hour window', () => {
  assert.equal(showFulfillmentDetails({ status: 'PENDING', refundStatus: 'NONE' }), false);
  assert.equal(showFulfillmentDetails({ status: 'PAID', refundStatus: 'NONE' }), true);
  assert.equal(showFulfillmentDetails({ status: 'CANCELLED', refundStatus: 'REQUIRED' }), true);
  assert.equal(formatQrCountdown('2026-10-18T12:00:00.000Z', Date.parse('2026-10-18T10:00:00.000Z')), '02:00:00');
  assert.equal(formatQrCountdown('2026-10-18T12:00:00.000Z', Date.parse('2026-10-18T10:00:15.000Z')), '01:59:45');
  assert.equal(formatQrCountdown('2026-10-18T10:00:00.000Z', Date.parse('2026-10-18T10:05:00.000Z')), '00:00:00');
  assert.equal(formatQrCountdown('invalid-date', Date.now()), null);
  for (const lang of ['ID', 'MY', 'EN']) assert.ok(translations[lang].qrActiveTimer);
});
