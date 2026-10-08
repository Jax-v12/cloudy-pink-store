import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteRegionalQuantity, parseMoney, formatMoney, regionalAmount } from '../src/lib/regionalPricing.ts';
import { checkoutInput, requestDigest } from '../src/lib/commerce.ts';
import { checkoutPricing, checkoutQuoteToken } from '../src/lib/checkoutPricing.ts';
import { paymentMethods, paymentTotals, paymentAdapter } from '../src/lib/paymentProvider.ts';

const rate = { units: 50, price: 7000, maxUnits: 5000, unitStep: 5, method: 'GAMEPASS', regionalPrices: [
  { region: 'MY', amount: 250, active: true }, { region: 'PH', amount: 3000, active: true },
] };
process.env.MIDTRANS_SERVER_KEY = 'isolated-test-key';
process.env.CHECKOUT_HASH_KEY = 'isolated-hash-key';

test('ID → MY → PH → ID uses independent prices with exact minor-unit rounding', () => {
  const expected = [['ID', 'IDR', 14000], ['MY', 'MYR', 500], ['PH', 'PHP', 6000], ['ID', 'IDR', 14000]];
  for (const [region, currency, total] of expected) {
    const quote = quoteRegionalQuantity(rate, region, 100);
    assert.equal(quote.totalAmount, total); assert.equal(quote.currency, currency); assert.equal(quote.units, 100);
  }
  const edited = { ...rate, price: 9000 };
  assert.equal(quoteRegionalQuantity(edited, 'MY', 100).totalAmount, 500);
  assert.equal(quoteRegionalQuantity(edited, 'PH', 100).totalAmount, 6000);
  assert.equal(quoteRegionalQuantity({ ...rate, regionalPrices: [{ region: 'MY', amount: 251, active: true }] }, 'MY', 55).totalAmount, 277);
  assert.equal(quoteRegionalQuantity({ ...rate, maxUnits: null, method: 'LOGIN' }, 'PH').totalAmount, 3000);
  assert.throws(() => quoteRegionalQuantity(rate, 'MY', 51));
  assert.throws(() => quoteRegionalQuantity({ ...rate, regionalPrices: [] }, 'PH'), /REGIONAL_PRICE_UNAVAILABLE/);
  assert.equal(regionalAmount({ ...rate, regionalPrices: [{ region: 'ID', active: false, amount: 7000 }] }, 'ID'), null);
});

test('decimal money input rejects rounding, overflow and malformed prices', () => {
  assert.equal(parseMoney('2.50', 'MYR'), 250); assert.equal(parseMoney('30', 'PHP'), 3000);
  assert.equal(parseMoney('7000.00', 'IDR'), 7000);
  for (const value of ['2.501', '-1', '1e3', 'NaN', '21474836.48']) assert.throws(() => parseMoney(value, 'MYR'));
  assert.throws(() => parseMoney('7000.01', 'IDR'));
  assert.match(formatMoney(250, 'MYR', 'MY'), /2[.,]50/);
  assert.match(formatMoney(3000, 'PHP', 'EN'), /30\.00/);
});

test('checkout rejects browser money, unsupported regions and unavailable regional providers', () => {
  const input = { productId: 1, variantId: 1, customerEmail: 'buyer@example.test', details: { username: 'customer' } };
  for (const field of ['price', 'unitPrice', 'currency', 'rate', 'subtotal', 'paymentFee', 'discount', 'totalAmount']) assert.throws(() => checkoutInput({ ...input, [field]: 1 }));
  for (const region of ['US', '', null, {}, 'id']) assert.throws(() => checkoutInput({ ...input, pricingRegion: region }));
  const a = checkoutInput({ ...input, pricingRegion: 'ID', paymentMethod: 'QRIS' });
  const b = checkoutInput({ ...input, pricingRegion: 'MY', paymentMethod: 'QRIS' });
  assert.notEqual(requestDigest(a), requestDigest(b));
  assert.deepEqual(paymentMethods('MY'), []); assert.deepEqual(paymentMethods('PH'), []);
  for (const region of ['MY', 'PH']) assert.throws(() => checkoutPricing('ROBLOX', 0, rate, region, 'QRIS', 100), /PAYMENT_REGION_UNAVAILABLE/);
  assert.throws(() => checkoutPricing('ROBLOX', 0, rate, 'ID', 'FAKE', 100), /PAYMENT_METHOD_UNAVAILABLE/);
  assert.throws(() => checkoutPricing('APPS', 7000, null, 'MY', 'QRIS'), /INVALID_INPUT/);
  const quote = checkoutPricing('ROBLOX', 0, rate, 'ID', 'QRIS', 100);
  assert.equal(quote.productSubtotal, 14000); assert.equal(quote.paymentFee, 0); assert.equal(quote.discount, 0); assert.equal(quote.totalAmount, 14000);
  const old = process.env.MIDTRANS_SERVER_KEY; delete process.env.MIDTRANS_SERVER_KEY;
  assert.deepEqual(paymentMethods('ID'), []); process.env.MIDTRANS_SERVER_KEY = old;
});

test('provider fee arithmetic uses integer rounding and guards total overflow', () => {
  assert.deepEqual(paymentTotals(1001, { feeBps: 70, fixedFee: 10 }), { productSubtotal: 1001, paymentFee: 18, discount: 0, totalAmount: 1019 });
  assert.throws(() => paymentTotals(2147483647, { feeBps: 1, fixedFee: 0 }));
});

test('quote confirmation binds the product, variant, region, quantity and payment totals', () => {
  const quote = checkoutPricing('ROBLOX', 0, rate, 'ID', 'QRIS', 100);
  const token = checkoutQuoteToken(1, 2, quote);
  assert.match(token, /^[a-f0-9]{64}$/);
  assert.notEqual(token, checkoutQuoteToken(2, 2, quote));
  assert.notEqual(token, checkoutQuoteToken(1, 3, quote));
  for (const patch of [{ totalAmount: 1 }, { paymentFee: 100 }, { pricingRegion: 'MY' }, { currency: 'MYR' }, { units: 50 }, { paymentMethod: 'FAKE' }]) assert.notEqual(token, checkoutQuoteToken(1, 2, { ...quote, ...patch }));
  assert.throws(() => checkoutInput({ productId: 1, customerEmail: 'buyer@example.test', quoteToken: 'invalid' }));
});

test('Midtrans adapter creates only IDR QRIS and validates the charge response', async () => {
  const order = { invoice: 'INV-test', totalAmount: 14000, pricingRegion: 'ID', currency: 'IDR', paymentProvider: 'MIDTRANS', paymentMethod: 'QRIS' };
  const previous = globalThis.fetch; let calls = 0;
  let response = { status_code: '201', order_id: order.invoice, gross_amount: '14000.00', currency: 'IDR', transaction_id: 'tx-test', qr_string: '000201-test' };
  globalThis.fetch = async (url, init) => {
    calls++; assert.match(String(url), /\/v2\/charge$/); const body = JSON.parse(init.body);
    assert.equal(body.transaction_details.gross_amount, 14000); assert.equal(body.payment_type, 'qris');
    return Response.json(response);
  };
  try {
    assert.deepEqual(await paymentAdapter(order).create(order, 'buyer@example.test'), { qr: '000201-test', reference: 'tx-test' });
    for (const patch of [{ currency: 'MYR' }, { pricingRegion: 'PH' }, { paymentMethod: 'FAKE' }]) await assert.rejects(paymentAdapter(order).create({ ...order, ...patch }, ''), /PAYMENT_PROVIDER_MISMATCH/);
    assert.equal(calls, 1);
    for (const patch of [{ currency: 'MYR' }, { gross_amount: '1.00' }, { order_id: 'wrong' }, { transaction_id: '' }]) {
      const saved = response; response = { ...response, ...patch };
      await assert.rejects(paymentAdapter(order).create(order, ''), /CHARGE_UNCONFIRMED/); response = saved;
    }
  } finally { globalThis.fetch = previous; }
});
