import test from 'node:test';
import assert from 'node:assert/strict';
import { orderNotice } from '../src/lib/orderNotice.ts';
import { invoiceStatusTranslations } from '../src/lib/invoiceStatusTranslations.ts';

const paid = { type: 'ROBLOX', status: 'PAID', fulfillmentStatus: 'QUEUED', refundStatus: 'NONE', account: null, qrisUrl: null };
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
