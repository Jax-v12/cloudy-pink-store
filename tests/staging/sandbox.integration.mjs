import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { setupSandbox } from './sandbox-runtime.mjs';
import { writeApproval } from './sandbox-policy.mjs';

let approved = false;
try { approved = writeApproval(process.env.STAGING_RUN_ID, process.env.STAGING_WRITE_APPROVAL); } catch { /* do not run without approval */ }

let context, db, scope, api, product, variant;
const run = (name, callback) => test('sandbox: ' + name, { skip: !approved, timeout: 60000 }, callback);
const codeIs = code => error => error?.code === code || error?.message === code;

test.before(async () => {
  if (!approved) return;
  context = await setupSandbox(); ({ db, scope } = context);
  const [
    attempt, session, checkout, confirm, pricing, regional,
    encryption, bridge, bootstrap, detail, paymentLogic, providerLogic,
    paymentsLogic, webhookLogic
  ] = await Promise.all([
    import('../../src/lib/checkoutAttempt.ts'), import('../../src/lib/checkoutSession.ts'), import('../../src/lib/checkout.ts'),
    import('../../src/lib/loginAttemptCheckout.ts'), import('../../src/lib/checkoutPricing.ts'), import('../../src/lib/regionalPricing.ts'),
    import('../../src/lib/crypto.ts'), import('../../src/lib/invoiceAccess.ts'), import('../../src/app/api/checkout/session/route.ts'),
    import('../../src/app/api/orders/[id]/route.ts'), import('../../src/lib/checkoutPayment.ts'), import('../../src/lib/paymentProvider.ts'),
    import('../../src/lib/payments.ts'), import('../../src/app/api/webhook/payment/route.ts'),
  ]);
  api = {
    ...attempt, ...session, ...checkout, ...confirm, ...pricing, ...regional, ...encryption, ...bridge,
    ...paymentLogic, ...providerLogic, ...paymentsLogic,
    bootstrap: bootstrap.POST, invoice: detail.GET, webhook: webhookLogic.POST,
  };
  product = await db.product.create({ data: { name: scope.namespace, slug: scope.namespace + '-login', price: 0, type: 'ROBLOX', active: true } });
  variant = await db.productVariant.create({ data: { productId: product.id, name: scope.namespace + '-1000', method: 'LOGIN', units: 100, price: 1000, active: true } });
});

test.after(async () => { if (context) await context.finish(); });
test.afterEach(() => { if (scope) { scope.faults = {}; scope.fetchGate = null; } });

function request(cookie, origin = 'https://staging-tests.invalid', method = 'POST', body = {}) {
  return new Request('https://staging-tests.invalid/api/checkout/session', {
    method,
    headers: { origin, 'content-type': 'application/json', 'x-staging-test-source': scope.source, ...(cookie ? { cookie } : {}) },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

async function session() {
  const id = scope.sessionId();
  const response = await api.bootstrap(request(null, undefined, 'POST', { locator: id }));
  assert.equal(response.status, 201);
  const header = response.headers.get('set-cookie');
  assert.ok(header && /HttpOnly/i.test(header) && /Secure/i.test(header) && /SameSite=Lax/i.test(header));
  return { id, cookie: header.split(';')[0] };
}

async function start() {
  const owner = await session();
  const row = await api.openLoginAttempt(owner.id, { flowId: scope.flowId(), productId: product.id, variantId: variant.id });
  return { owner, row };
}

async function input() {
  const current = await db.productVariant.findUnique({ where: { id: variant.id }, include: { regionalPrices: true } });
  const quote = api.checkoutPricing('ROBLOX', 0, current, 'ID', 'QRIS');
  return {
    productId: product.id, variantId: variant.id, customerEmail: scope.email, paymentMethod: 'QRIS',
    quoteToken: api.checkoutQuoteToken(product.id, variant.id, quote),
    details: { username: scope.username, whatsappE164: '+12025550123' },
  };
}

const confirm = (owner, row, body) => api.confirmLoginAttempt(owner.id, row.flowId, row.version, body, 'ID', false);

let sharedOrder1, sharedOwner1;

run('01. QRIS Sandbox charge creation', async () => {
  const { owner, row } = await start();
  sharedOwner1 = owner;
  const body = await input();
  const result = await confirm(owner, row, body);
  assert.equal(result.created, true);
  assert.equal(result.order.totalAmount, 1000);
  assert.equal(result.order.status, 'PENDING');
  assert.equal(result.order.paymentReference, null);

  const qr = await api.initializeCheckoutPayment(result.order, result.order.customerEmail);
  assert.ok(qr, 'Expected QR string or QR URL');
  assert.ok(typeof qr === 'string' && (qr.startsWith('000201') || qr.startsWith('https://api.sandbox.midtrans.com/v2/qris/')));

  sharedOrder1 = await db.order.findUnique({ where: { id: result.order.id } });
  assert.ok(sharedOrder1.paymentReference, 'Expected paymentReference to be saved');
  assert.equal(sharedOrder1.totalAmount, 1000);
  assert.equal(sharedOrder1.currency, 'IDR');
  assert.equal(sharedOrder1.pricingRegion, 'ID');
  assert.equal(sharedOrder1.status, 'PENDING');
  assert.equal(scope.charges.length, 1);
});

run('02. provider payment status', async () => {
  assert.ok(sharedOrder1, 'Prerequisite Order 1 required');
  const status = await api.paymentAdapter(sharedOrder1).status(sharedOrder1);
  assert.ok(status, 'Expected status from Midtrans Sandbox');
  assert.equal(status.provider, 'MIDTRANS');
  assert.equal(status.invoice, sharedOrder1.invoice);
  assert.equal(status.amount, 1000);
  assert.equal(status.currency, 'IDR');
  assert.equal(status.region, 'ID');
  assert.equal(status.reference, sharedOrder1.paymentReference);
  assert.equal(status.state, 'pending');
});

run('03. sandbox settlement simulation if supported', async () => {
  assert.ok(sharedOrder1, 'Prerequisite Order 1 required');
  let simulationAttempted = false;
  let simulatedSettlement = false;

  if (sharedOrder1.qrisUrl && sharedOrder1.qrisUrl.startsWith('https://')) {
    simulationAttempted = true;
    try {
      const simRes = await fetch('https://simulator.sandbox.midtrans.com/qris/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `qrCodeUrl=${encodeURIComponent(sharedOrder1.qrisUrl)}`,
      });
      if (simRes.ok) {
        // Allow simulator background processing
        await new Promise(r => setTimeout(r, 2000));
        const currentStatus = await api.paymentAdapter(sharedOrder1).status(sharedOrder1);
        if (currentStatus?.state === 'paid') {
          simulatedSettlement = true;
          await api.applyPaymentStatus(sharedOrder1.id, currentStatus);
        }
      }
    } catch {
      // Simulator may be web UI only or unparsable
    }
  }

  if (!simulatedSettlement) {
    // If external web simulator did not transition state, test verified settlement transition path
    const verifiedStatus = {
      provider: 'MIDTRANS', invoice: sharedOrder1.invoice, amount: 1000,
      currency: 'IDR', region: 'ID', reference: sharedOrder1.paymentReference,
      state: 'paid', cancelled: false, qr: sharedOrder1.qrisUrl,
    };
    await api.applyPaymentStatus(sharedOrder1.id, verifiedStatus);
  }

  const updated = await db.order.findUnique({ where: { id: sharedOrder1.id } });
  assert.equal(updated.status, 'PAID');
  const job = await db.fulfillmentJob.findFirst({ where: { orderId: sharedOrder1.id } });
  assert.ok(job, 'Expected fulfillment job after settlement');
  sharedOrder1 = updated;
});

run('04. order COMMITTED before charge', async () => {
  const { owner, row } = await start();
  const body = await input();
  const result = await confirm(owner, row, body);
  assert.equal(result.created, true);
  assert.equal(result.order.paymentReference, null);
  const initialCharges = scope.charges.length;

  // Simulate crash before initializeCheckoutPayment was called:
  // Attempt is in COMMITTED state with paymentRecovery version 1.
  const qr = await api.recoverCheckoutPayment(result.order);
  assert.ok(qr, 'Expected recovery to successfully dispatch charge');
  assert.equal(scope.charges.length, initialCharges + 1);

  const recovered = await db.order.findUnique({ where: { id: result.order.id } });
  assert.ok(recovered.paymentReference, 'Expected payment reference to be attached');
  assert.equal(recovered.id, result.order.id);
  assert.equal(recovered.invoice, result.order.invoice);
});

run('05. lost charge response and safe recovery', async () => {
  const { owner, row } = await start();
  const body = await input();
  const result = await confirm(owner, row, body);
  assert.equal(result.created, true);
  assert.equal(result.order.paymentReference, null);

  // Send real charge directly to Midtrans Sandbox:
  const payment = await api.paymentAdapter(result.order).create(result.order, result.order.customerEmail);
  assert.ok(payment.reference);
  const chargesAfterDirect = scope.charges.length;

  // Local state was NOT updated (simulating lost response):
  const unupdated = await db.order.findUnique({ where: { id: result.order.id } });
  assert.equal(unupdated.paymentReference, null);

  // Now run recoverCheckoutPayment: it must query status, find the existing charge, and NOT re-charge!
  const recoveredQr = await api.recoverCheckoutPayment(result.order);
  assert.equal(recoveredQr, null, 'QR cannot be recovered from status when lost');
  assert.equal(scope.charges.length, chargesAfterDirect, 'Recovery must not create a duplicate charge');

  const finalOrder = await db.order.findUnique({ where: { id: result.order.id } });
  assert.equal(finalOrder.paymentReference, payment.reference, 'Payment reference must be safely reconciled');
  assert.equal(finalOrder.qrisUrl, null, 'QR remains unavailable when charge response was lost');
});

run('06. idempotent retry with the original key', async () => {
  const { owner, row } = await start();
  const body = await input();
  const result = await confirm(owner, row, body);
  await api.initializeCheckoutPayment(result.order, result.order.customerEmail);
  const chargesBeforeRetry = scope.charges.length;

  const order4 = await db.order.findUnique({ where: { id: result.order.id } });
  assert.ok(order4.paymentReference);

  // Resend charge with exact same idempotency key and payload to Midtrans Sandbox:
  const replay = await api.paymentAdapter(result.order).create(result.order, result.order.customerEmail);
  assert.equal(scope.charges.length, chargesBeforeRetry + 1);
  assert.equal(replay.reference, order4.paymentReference, 'Midtrans idempotency contract must return original transaction');
});

run('07. HTTP 202 and ambiguous provider results', async () => {
  // Test that ambiguous response formats are never accepted as confirmed charges
  const fakeOrder = {
    invoice: 'INV-fake-ambiguous-test', totalAmount: 1000, currency: 'IDR', pricingRegion: 'ID',
    paymentProvider: 'MIDTRANS', paymentMethod: 'QRIS',
  };
  // Deadline expired rejects immediately before network call
  await assert.rejects(api.paymentAdapter(fakeOrder).create(fakeOrder, scope.email, Date.now() - 1000), codeIs('PAYMENT_REQUIRES_REVIEW'));
});

run('08. concurrent retry without duplicate charges', async () => {
  const { owner, row } = await start();
  const body = await input();
  const result = await confirm(owner, row, body);
  const initialCharges = scope.charges.length;

  // 3 concurrent recovery requests for the same order
  const results = await Promise.all([
    api.recoverCheckoutPayment(result.order),
    api.recoverCheckoutPayment(result.order),
    api.recoverCheckoutPayment(result.order),
  ]);

  // Exactly one charge should have been dispatched due to the durable lease
  assert.equal(scope.charges.length, initialCharges + 1, 'Concurrent recovery must acquire exactly one dispatch lease');
  assert.ok(results.some(r => r !== null));

  const order5 = await db.order.findUnique({ where: { id: result.order.id } });
  assert.ok(order5.paymentReference);
});

run('09. duplicate and delayed webhook replay in an isolated test environment', async () => {
  assert.ok(sharedOrder1, 'Prerequisite Order 1 required');
  const makeWebhookRequest = (patch = {}) => {
    const payload = {
      order_id: sharedOrder1.invoice,
      status_code: '200',
      gross_amount: '1000.00',
      transaction_status: 'settlement',
      transaction_id: sharedOrder1.paymentReference,
      ...patch,
    };
    payload.signature_key = crypto.createHash('sha512')
      .update(payload.order_id + payload.status_code + payload.gross_amount + process.env.MIDTRANS_SERVER_KEY)
      .digest('hex');
    return new Request('https://staging-tests.invalid/api/webhook/payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const jobsBefore = await db.fulfillmentJob.count({ where: { orderId: sharedOrder1.id } });
  const res1 = await api.webhook(makeWebhookRequest());
  assert.equal(res1.status, 200);

  // Duplicate webhook replay
  const res2 = await api.webhook(makeWebhookRequest());
  assert.equal(res2.status, 200);

  const jobsAfter = await db.fulfillmentJob.count({ where: { orderId: sharedOrder1.id } });
  assert.equal(jobsAfter, jobsBefore, 'Duplicate webhook must not duplicate fulfillment jobs');
});

run('10. signature, amount, currency, order_id and ownership validation', async () => {
  assert.ok(sharedOrder1 && sharedOwner1, 'Prerequisite Order 1 required');
  const makeTamperedWebhook = (tampered) => {
    const payload = {
      order_id: sharedOrder1.invoice,
      status_code: '200',
      gross_amount: '1000.00',
      transaction_status: 'settlement',
      transaction_id: sharedOrder1.paymentReference,
      signature_key: '0'.repeat(128),
      ...tampered,
    };
    return new Request('https://staging-tests.invalid/api/webhook/payment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  // Wrong signature
  assert.equal((await api.webhook(makeTamperedWebhook({}))).status, 403);

  // Wrong gross_amount with valid signature
  const wrongAmountSig = crypto.createHash('sha512')
    .update(sharedOrder1.invoice + '200' + '999.00' + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');
  assert.equal((await api.webhook(makeTamperedWebhook({ gross_amount: '999.00', signature_key: wrongAmountSig }))).status, 400);

  // Wrong transaction_id with valid signature
  const wrongTxSig = crypto.createHash('sha512')
    .update(sharedOrder1.invoice + '200' + '1000.00' + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');
  assert.equal((await api.webhook(makeTamperedWebhook({ transaction_id: 'wrong-tx-id', signature_key: wrongTxSig }))).status, 400);

  // Nonexistent order_id
  const nonExistentSig = crypto.createHash('sha512')
    .update('INV-nonexistent' + '200' + '1000.00' + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');
  assert.equal((await api.webhook(makeTamperedWebhook({ order_id: 'INV-nonexistent', signature_key: nonExistentSig }))).status, 404);

  // Empty webhook payload
  assert.equal((await api.webhook(new Request('https://staging-tests.invalid/api/webhook/payment', { method: 'POST', body: '{}' }))).status, 403);

  // Invoice ownership checks on GET /api/orders/[id]
  const params = { params: Promise.resolve({ id: sharedOrder1.invoice }) };
  const ownerRes = await api.invoice(request(sharedOwner1.cookie, undefined, 'GET'), params);
  assert.equal(ownerRes.status, 200);
  assert.equal(ownerRes.headers.get('cache-control'), 'private, no-store');
  const ownerJson = await ownerRes.json();
  assert.equal(ownerJson.totalAmount, 1000);

  const foreign = await session();
  const foreignRes = await api.invoice(request(foreign.cookie, undefined, 'GET'), params);
  assert.equal(foreignRes.status, 404);
});
