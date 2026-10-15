import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';

process.env.MIDTRANS_SERVER_KEY = 'isolated-recovery-key';
process.env.TELEGRAM_BOT_TOKEN = '';
process.env.TELEGRAM_ADMIN_CHAT_ID = '';
let order, attempt, now, calls, provider, chargeMode, statusMode, jobs, failDispatchWrite, tail = Promise.resolve();
const transactionScope = new AsyncLocalStorage();
const originalFetch = globalThis.fetch;
const db = {
  $queryRaw: async strings => strings.join('').includes('CURRENT_TIMESTAMP') ? [{ now: new Date(now) }] : [],
  order: {
    findUnique: async ({ where } = {}) => {
      if (where?.invoice && where.invoice !== order.invoice) return null;
      if (where?.id && where.id !== order.id) return null;
      return structuredClone(order);
    },
    findUniqueOrThrow: async ({ where } = {}) => {
      if (where?.invoice && where.invoice !== order.invoice) throw new Error('ORDER_NOT_FOUND');
      if (where?.id && where.id !== order.id) throw new Error('ORDER_NOT_FOUND');
      return structuredClone(order);
    },
    update: async ({ data }) => { Object.assign(order, data); return structuredClone(order); },
    updateMany: async ({ where, data }) => {
      if (where.status && where.status !== order.status) return { count: 0 };
      Object.assign(order, data); return { count: 1 };
    },
  },
  checkoutAttempt: {
    findUnique: async () => structuredClone(attempt),
    update: async ({ data }) => {
      if (failDispatchWrite) throw new Error('synthetic dispatch commit failure');
      Object.assign(attempt, data); return structuredClone(attempt);
    },
  },
  fulfillmentJob: { upsert: async () => { jobs.add(order.id); } },
  orderSecret: { deleteMany: async () => ({ count: 0 }) },
  $transaction: async callback => {
    const previous = tail; let release; tail = new Promise(resolve => { release = resolve; }); await previous;
    try { return await transactionScope.run(true, () => callback(db)); } finally { release(); }
  },
};
globalThis.prisma = db;
const { initializeCheckoutPayment, recoverCheckoutPayment } = await import('../src/lib/checkoutPayment.ts');
const { paymentAdapter } = await import('../src/lib/paymentProvider.ts');
const { POST: webhook } = await import('../src/app/api/webhook/payment/route.ts');

test.beforeEach(() => {
  now = Date.now(); calls = []; provider = null; chargeMode = 'success'; statusMode = 'normal'; jobs = new Set(); failDispatchWrite = false;
  order = { id: 1, invoice: 'INV-synthetic-recovery', type: 'ROBLOX', status: 'PENDING', totalAmount: 7000,
    pricingRegion: 'ID', currency: 'IDR', paymentMethod: 'QRIS', paymentProvider: 'MIDTRANS',
    paymentReference: null, qrisUrl: null, customerEmail: 'synthetic@example.invalid', accountStockId: null,
    expiresAt: new Date(now + 86400_000), createdAt: new Date(now) };
  attempt = { id: 'synthetic-attempt', orderId: 1, state: 'COMMITTED', quoteSnapshot: { totalAmount: 7000, paymentRecovery: { version: 1 } } };
  globalThis.fetch = async (url, init) => {
    assert.notEqual(transactionScope.getStore(), true, 'provider calls must never hold database locks');
    calls.push({ method: init.method ?? 'GET', headers: init.headers, body: init.body });
    if (String(url).endsWith('/status')) {
      if (statusMode === 'unavailable') return Response.json({ status_code: '503' }, { status: 503 });
      if (statusMode === 'empty') return Response.json({});
      if (statusMode === 'empty-404') return Response.json(null, { status: 404 });
      if (statusMode === 'processing') return Response.json({ status_code: '202' }, { status: 202 });
      if (provider) {
        const statusPayload = { ...provider };
        delete statusPayload.qr_string;
        return Response.json(statusPayload);
      }
      return Response.json({ status_code: '404', order_id: order.invoice }, { status: 404 });
    }
    assert.match(String(url), /\/v2\/charge$/);
    const invoice = JSON.parse(init.body).transaction_details.order_id;
    if (chargeMode === 'timeout-before-provider') throw new DOMException('synthetic timeout', 'TimeoutError');
    provider ??= { order_id: invoice, transaction_id: 'synthetic-transaction', status_code: '201', transaction_status: 'pending',
      gross_amount: '7000.00', currency: 'IDR', qr_string: '000201synthetic' };
    if (chargeMode === 'lost-response') throw new TypeError('synthetic lost response');
    if (chargeMode === 'processing') return Response.json({ status_code: '202', status_message: 'Request is processing' }, { status: 202 });
    if (chargeMode === 'processing-success-shaped') return Response.json(provider, { status: 202 });
    return Response.json(provider);
  };
});
test.after(() => { globalThis.fetch = originalFetch; delete globalThis.prisma; });
const charges = () => calls.filter(call => call.method === 'POST');
const recover = () => recoverCheckoutPayment(structuredClone(order));

test('crash after Order commit before charge is recovered with the same Order identity', async () => {
  now += 600_000; // No dispatch occurred: recovery is not tied to order creation time.
  assert.equal(await recover(), '000201synthetic');
  assert.equal(charges().length, 1); assert.equal(order.id, 1);
  assert.equal(order.paymentReference, 'synthetic-transaction');
  assert.equal(attempt.quoteSnapshot.totalAmount, 7000);
});

test('lost charge response reconciles the existing transaction without another charge', async () => {
  chargeMode = 'lost-response';
  assert.equal(await initializeCheckoutPayment(order, order.customerEmail), null);
  assert.equal(order.paymentReference, null);
  assert.equal(await recover(), null);
  assert.equal(charges().length, 1);
  assert.equal(order.paymentReference, provider.transaction_id);
  assert.equal(order.qrisUrl, null);
});

test('timeout checks provider first and retry uses the identical key only inside its lifetime', async () => {
  chargeMode = 'timeout-before-provider';
  await initializeCheckoutPayment(order, order.customerEmail);
  assert.equal(await recover(), null); assert.equal(charges().length, 1);
  now += 21_000; chargeMode = 'success';
  assert.equal(await recover(), '000201synthetic');
  assert.equal(charges().length, 2);
  const keys = charges().map(call => new Headers(call.headers).get('idempotency-key'));
  assert.ok(keys[0] && keys[0].length <= 46); assert.equal(keys[0], keys[1]);
  assert.equal(calls.at(-2).method, 'GET');
});

test('concurrent recovery obtains one durable dispatch lease', async () => {
  await Promise.all([recover(), recover(), recover()]);
  assert.equal(charges().length, 1); assert.equal(order.paymentReference, provider.transaction_id);
});

test('existing provider charge is reconciled even after the retry window', async () => {
  await recover(); now += 600_000;
  order.paymentReference = null;
  assert.equal(await recover(), '000201synthetic'); assert.equal(charges().length, 1);
  // When qrisUrl was also lost, paymentReference is reconciled and null returned without duplicate charge:
  order.paymentReference = null; order.qrisUrl = null;
  assert.equal(await recover(), null); assert.equal(charges().length, 1);
  assert.equal(order.paymentReference, provider.transaction_id);
});

test('ambiguous dispatch beyond four minutes stops charging and requires review', async () => {
  chargeMode = 'timeout-before-provider'; await initializeCheckoutPayment(order, order.customerEmail);
  now += 240_000;
  await assert.rejects(recover(), /PAYMENT_REQUIRES_REVIEW/);
  assert.equal(charges().length, 1); assert.equal(order.status, 'PENDING');
});

test('provider unavailable never turns uncertainty into a new charge', async () => {
  statusMode = 'unavailable'; await assert.rejects(recover(), /GATEWAY_STATUS_UNVERIFIED/);
  assert.equal(charges().length, 0); assert.equal(order.status, 'PENDING');
});

test('empty, unstructured not-found and processing lookups remain UNKNOWN and never authorize dispatch', async () => {
  for (const mode of ['empty', 'empty-404', 'processing']) {
    statusMode = mode;
    await assert.rejects(recover(), /GATEWAY_STATUS_UNVERIFIED/);
    assert.equal(charges().length, 0);
    assert.deepEqual(attempt.quoteSnapshot.paymentRecovery, { version: 1 });
  }
});

test('HTTP 202 charge remains unconfirmed, preserves its dispatch key and recovers by status', async () => {
  chargeMode = 'processing';
  assert.equal(await initializeCheckoutPayment(order, order.customerEmail), null);
  assert.equal(order.paymentReference, null); assert.equal(order.qrisUrl, null);
  const firstDispatch = attempt.quoteSnapshot.paymentRecovery.firstDispatchAt;
  const firstKey = new Headers(charges()[0].headers).get('idempotency-key');
  provider = null; now += 21_000;
  await assert.rejects(recover(), /CHARGE_UNCONFIRMED/);
  assert.equal(attempt.quoteSnapshot.paymentRecovery.firstDispatchAt, firstDispatch);
  assert.equal(new Headers(charges()[1].headers).get('idempotency-key'), firstKey);
  assert.equal(charges().length, 2);
  assert.equal(await recover(), null); // Status does not include QR string; reference is safely reconciled.
  assert.equal(charges().length, 2); assert.equal(order.paymentReference, 'synthetic-transaction');
});

test('HTTP 202 cannot be accepted as a confirmed charge even with success-shaped body fields', async () => {
  chargeMode = 'processing-success-shaped';
  assert.equal(await initializeCheckoutPayment(order, order.customerEmail), null);
  assert.equal(order.paymentReference, null); assert.equal(order.qrisUrl, null);
  assert.equal(await recover(), null);
  assert.equal(charges().length, 1);
  assert.equal(order.paymentReference, 'synthetic-transaction');
});

test('dispatch persistence failure and invalid timestamps never send a provider POST', async () => {
  failDispatchWrite = true;
  await assert.rejects(recover(), /synthetic dispatch commit failure/);
  assert.equal(charges().length, 0);
  failDispatchWrite = false;
  for (const metadata of [
    { version: 1, firstDispatchAt: 'invalid' },
    { version: 1, firstDispatchAt: null },
    { version: 1, firstDispatchAt: now + 1 },
    { version: 1, firstDispatchAt: now, lastDispatchAt: now - 1 },
  ]) {
    attempt.quoteSnapshot.paymentRecovery = metadata;
    await assert.rejects(recover(), /PAYMENT_REQUIRES_REVIEW/);
    assert.equal(charges().length, 0);
  }
});

test('legacy unmarked, expired, referenced and terminal orders cannot start a recovery charge', async () => {
  for (const alter of [() => { attempt.quoteSnapshot = {}; }, () => { order.expiresAt = new Date(now); },
    () => { order.paymentReference = 'already-known'; }, () => { order.status = 'PAID'; }]) {
    const savedOrder = structuredClone(order), savedAttempt = structuredClone(attempt);
    alter(); await recover(); assert.equal(charges().length, 0); order = savedOrder; attempt = savedAttempt;
  }
});

test('late and duplicate webhooks settle once; differentiate 403, 400, 404, 503', async () => {
  chargeMode = 'lost-response'; await initializeCheckoutPayment(order, order.customerEmail);
  provider = { ...provider, status_code: '200', transaction_status: 'settlement' };
  const request = (patch = {}) => {
    const body = { ...provider, ...patch };
    body.signature_key = crypto.createHash('sha512').update(body.order_id + body.status_code + body.gross_amount + process.env.MIDTRANS_SERVER_KEY).digest('hex');
    return new Request('https://store.invalid/api/webhook/payment', { method: 'POST', body: JSON.stringify(body) });
  };
  // 1. Success & idempotency
  assert.equal((await webhook(request())).status, 200); assert.equal((await webhook(request())).status, 200);
  assert.equal(order.status, 'PAID'); assert.equal(jobs.size, 1); assert.equal(charges().length, 1);

  // 2. Invalid signature -> 403
  assert.equal((await webhook(new Request('https://store.invalid/api/webhook/payment', { method: 'POST', body: '{}' }))).status, 403);
  const badSig = { ...provider, signature_key: '0'.repeat(128) };
  assert.equal((await webhook(new Request('https://store.invalid/api/webhook/payment', { method: 'POST', body: JSON.stringify(badSig) }))).status, 403);

  // 3. Amount mismatch -> 400
  assert.equal((await webhook(request({ gross_amount: '1.00' }))).status, 400);

  // 4. Transaction mismatch with order or status -> 400
  assert.equal((await webhook(request({ transaction_id: 'wrong' }))).status, 400);

  // 5. Unknown order -> 404
  const unknownOrderBody = { ...provider, order_id: 'INV-nonexistent' };
  unknownOrderBody.signature_key = crypto.createHash('sha512').update(unknownOrderBody.order_id + unknownOrderBody.status_code + unknownOrderBody.gross_amount + process.env.MIDTRANS_SERVER_KEY).digest('hex');
  assert.equal((await webhook(new Request('https://store.invalid/api/webhook/payment', { method: 'POST', body: JSON.stringify(unknownOrderBody) }))).status, 404);

  // 6. Transient gateway failure -> 503
  statusMode = 'unavailable';
  assert.equal((await webhook(request())).status, 503);
  statusMode = 'normal';
});

test('provider idempotency keys differ across invoices and delayed dispatch cannot bypass its deadline', async () => {
  await paymentAdapter(order).create(order, order.customerEmail);
  const first = new Headers(charges()[0].headers).get('idempotency-key');
  provider = null;
  await paymentAdapter(order).create({ ...order, invoice: 'INV-another-synthetic' }, order.customerEmail);
  const second = new Headers(charges()[1].headers).get('idempotency-key');
  assert.notEqual(first, second);
  await assert.rejects(paymentAdapter(order).create(order, order.customerEmail, Date.now() - 1), /PAYMENT_REQUIRES_REVIEW/);
  assert.equal(charges().length, 2);
});
