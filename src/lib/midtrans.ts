import crypto from 'crypto';

export interface GatewayStatus {
  order_id: string;
  status_code: string;
  transaction_status: string;
  gross_amount: string;
  currency: string;
  fraud_status?: string;
}

export function gatewayBase() {
  return process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
}

export function gatewayHeaders() {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key?.trim()) throw new Error('GATEWAY_CONFIG_REQUIRED');
  return { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}` };
}

export function verifySignature(body: Record<string, unknown>): boolean {
  const { order_id, status_code, gross_amount, signature_key } = body;
  if (typeof order_id !== 'string' || order_id.length > 191 || !order_id ||
      typeof status_code !== 'string' || !/^\d{3}$/.test(status_code) ||
      typeof gross_amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(gross_amount) ||
      typeof signature_key !== 'string' || !/^[a-f\d]{128}$/i.test(signature_key)) return false;
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key?.trim()) throw new Error('GATEWAY_CONFIG_REQUIRED');
  const expected = crypto.createHash('sha512').update(`${order_id}${status_code}${gross_amount}${key}`).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature_key, 'hex'));
}

export async function getGatewayStatus(invoice: string, total: number): Promise<GatewayStatus | null> {
  const response = await fetch(`${gatewayBase()}/v2/${encodeURIComponent(invoice)}/status`, {
    headers: gatewayHeaders(), cache: 'no-store', signal: AbortSignal.timeout(10_000), redirect: 'error',
  });
  const data = await response.json();
  // Only a structured, definitive "not found" may release an expired orphan.
  if ((response.ok || response.status === 404) && data?.status_code === '404' && (!data.order_id || data.order_id === invoice)) return null;
  if (!response.ok || !data || data.order_id !== invoice || data.currency !== 'IDR' ||
      typeof data.gross_amount !== 'string' || !/^\d{1,10}(?:\.\d{1,2})?$/.test(data.gross_amount) ||
      Number(data.gross_amount) !== total || !['200', '201', '202'].includes(data.status_code) ||
      !['pending', 'capture', 'settlement', 'deny', 'expire', 'cancel', 'refund', 'partial_refund', 'authorize'].includes(data.transaction_status)) {
    throw new Error('GATEWAY_STATUS_UNVERIFIED');
  }
  return data as GatewayStatus;
}

export function paymentState(status: GatewayStatus): 'paid' | 'failed' | 'pending' {
  if (status.status_code === '200' && ['capture', 'settlement'].includes(status.transaction_status) &&
      (!status.fraud_status || status.fraud_status === 'accept')) return 'paid';
  if (['deny', 'expire', 'cancel'].includes(status.transaction_status)) return 'failed';
  return 'pending';
}

export function isGatewayQrUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['api.midtrans.com', 'api.sandbox.midtrans.com'].includes(url.hostname) &&
      !url.username && !url.password && !url.port && /^\/v[24]\/qris\/[^/]+\/qr-code$/.test(url.pathname);
  } catch { return false; }
}

export function extractQr(data: Record<string, unknown>): string | null {
  if (Array.isArray(data.actions)) {
    const action = data.actions.find(a => a && ['generate-qr-code', 'generate-qr-code-v2'].includes(a.name) && typeof a.url === 'string' && isGatewayQrUrl(a.url));
    if (action) return action.url;
  }
  return typeof data.qr_string === 'string' && /^000201/.test(data.qr_string) && data.qr_string.length <= 3000 ? data.qr_string : null;
}
