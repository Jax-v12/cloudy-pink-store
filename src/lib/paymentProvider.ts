import { gatewayBase, gatewayHeaders, extractQr, getGatewayStatus, paymentState } from './midtrans';
import { type Region, type Currency, REGION_CURRENCY } from './regionalPricing';

export type PaymentMethod = { id: string; provider: string; label: string; feeBps: number; fixedFee: number };
// Only server-side provider adapters construct verified payment results.
export type VerifiedPayment = {
  provider: string; invoice: string; amount: number; currency: Currency; region: Region; reference: string;
  state: 'paid' | 'pending' | 'failed'; cancelled: boolean; qr: string | null;
};
type PaymentOrder = { invoice: string; totalAmount: number; currency: string; pricingRegion: string; paymentProvider: string; paymentMethod: string };
interface PaymentAdapter {
  id: string;
  methods(region: Region, currency: Currency): PaymentMethod[];
  create(order: PaymentOrder, email: string): Promise<{ qr: string; reference: string }>;
  status(order: PaymentOrder): Promise<VerifiedPayment | null>;
}
const midtrans: PaymentAdapter = {
  id: 'MIDTRANS',
  methods: (region, currency) => region === 'ID' && currency === 'IDR' && process.env.MIDTRANS_SERVER_KEY?.trim()
    ? [{ id: 'QRIS', provider: 'MIDTRANS', label: 'QRIS', feeBps: 0, fixedFee: 0 }] : [],
  async create(order, email) {
    assertMidtransOrder(order);
    const response = await fetch(`${gatewayBase()}/v2/charge`, {
      method: 'POST', headers: gatewayHeaders(), signal: AbortSignal.timeout(15_000), redirect: 'error',
      body: JSON.stringify({ transaction_details: { order_id: order.invoice, gross_amount: order.totalAmount },
        payment_type: 'qris', qris: { acquirer: 'gopay' }, customer_details: { email } }),
    });
    const data = await response.json();
    if (!response.ok || data?.status_code !== '201' || data.order_id !== order.invoice ||
        Number(data.gross_amount) !== order.totalAmount || data.currency !== 'IDR' ||
        typeof data.transaction_id !== 'string' || !data.transaction_id || data.transaction_id.length > 191) throw new Error('CHARGE_UNCONFIRMED');
    const qr = extractQr(data);
    if (!qr) throw new Error('QR_UNAVAILABLE');
    return { qr, reference: data.transaction_id };
  },
  async status(order) {
    assertMidtransOrder(order);
    const status = await getGatewayStatus(order.invoice, order.totalAmount);
    if (!status) return null;
    return { provider: 'MIDTRANS', invoice: status.order_id, amount: Number(status.gross_amount),
      currency: 'IDR', region: 'ID', reference: status.transaction_id!, state: paymentState(status),
      cancelled: status.transaction_status === 'cancel', qr: extractQr(status as unknown as Record<string, unknown>) };
  },
};
function assertMidtransOrder(order: PaymentOrder) {
  if (order.paymentProvider !== 'MIDTRANS' || order.pricingRegion !== 'ID' || order.currency !== 'IDR' || order.paymentMethod !== 'QRIS') throw new Error('PAYMENT_PROVIDER_MISMATCH');
}
// Register only implemented integrations. MY/PH deliberately have no adapter yet.
const adapters: PaymentAdapter[] = [midtrans];
export function paymentMethods(region: Region): PaymentMethod[] {
  return adapters.flatMap(adapter => adapter.methods(region, REGION_CURRENCY[region]));
}
export function paymentTotals(subtotal: number, method: PaymentMethod) {
  const fee = (BigInt(subtotal) * BigInt(method.feeBps) + BigInt(9999)) / BigInt(10000) + BigInt(method.fixedFee);
  const total = BigInt(subtotal) + fee;
  if (!Number.isSafeInteger(subtotal) || subtotal < 1 || fee < BigInt(0) || total > BigInt(2147483647)) throw new RangeError('INVALID_AMOUNT');
  return { productSubtotal: subtotal, paymentFee: Number(fee), discount: 0, totalAmount: Number(total) };
}
export function paymentAdapter(order: PaymentOrder) {
  const adapter = adapters.find(a => a.id === order.paymentProvider);
  if (!adapter) throw new Error('PAYMENT_PROVIDER_UNAVAILABLE');
  return adapter;
}
