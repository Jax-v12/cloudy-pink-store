import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createLegacyCheckout } from '@/lib/checkout';
import { CommerceError } from '@/lib/commerce';
import { InputError, readJson, positiveInt, privateHeaders, logFailure } from '@/lib/http';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { initializeCheckoutPayment } from '@/lib/checkoutPayment';
import { resolveRequestRegion } from '@/lib/requestRegion';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await readJson(req, 12_288);
    const { productId, customerEmail } = body;
    if (!positiveInt(productId) || typeof customerEmail !== 'string' || customerEmail.length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())) throw new InputError();
    const email = customerEmail.trim().toLowerCase();
    if (!(await consumeRateLimit('checkout-source', clientKey(req), 10, 15 * 60_000)) ||
        !(await consumeRateLimit('checkout-email', email, 5, 60 * 60_000))) {
      return NextResponse.json({ errorCode: 'RATE_LIMIT_EXCEEDED' }, { status: 429 });
    }
    const { order, created } = await createLegacyCheckout(body, req.headers.get('idempotency-key') || crypto.randomUUID(), resolveRequestRegion(req).region);
    if (!created) return NextResponse.json({ success: true, data: {
      invoice: order.invoice, accessToken: order.accessToken, qrisUrl: order.qrisUrl,
    } }, { status: order.qrisUrl ? 200 : 202, headers: privateHeaders });
    const qr = await initializeCheckoutPayment(order, email);
    return NextResponse.json({ success: true, data: {
      invoice: order.invoice, accessToken: order.accessToken, qrisUrl: qr,
    } }, { status: qr ? 200 : 202, headers: privateHeaders });
  } catch (error) {
    if (error instanceof CommerceError) return NextResponse.json({ success: false, errorCode: error.code }, { status: error.status, headers: privateHeaders });
    if (error instanceof InputError) return NextResponse.json({ errorCode: 'INVALID_INPUT' }, { status: error.status });
    if (error instanceof Error && ['STOCK_EMPTY', 'RACE_CONDITION'].includes(error.message)) {
      return NextResponse.json({ errorCode: error.message }, { status: error.message === 'STOCK_EMPTY' ? 400 : 409 });
    }
    logFailure('Checkout failed', error);
    return NextResponse.json({ errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
