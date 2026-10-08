import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createCheckout } from '@/lib/checkout';
import { CommerceError } from '@/lib/commerce';
import { prisma } from '@/lib/prisma';
import { InputError, readJson, positiveInt, privateHeaders, logFailure } from '@/lib/http';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { paymentAdapter } from '@/lib/paymentProvider';
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
    const { order, created } = await createCheckout(body, req.headers.get('idempotency-key') || crypto.randomUUID(), resolveRequestRegion(req).region);
    if (!created) return NextResponse.json({ success: true, data: {
      invoice: order.invoice, accessToken: order.accessToken, qrisUrl: order.qrisUrl,
    } }, { status: order.qrisUrl ? 200 : 202, headers: privateHeaders });
    let qr: string | null = null;
    try {
      const payment = await paymentAdapter(order).create(order, email);
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${order.id} FOR UPDATE`;
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        if (current.paymentReference && current.paymentReference !== payment.reference) throw new Error('PAYMENT_REFERENCE_MISMATCH');
        await tx.order.update({ where: { id: order.id }, data: { paymentReference: payment.reference, ...(current.status === 'PENDING' ? { qrisUrl: payment.qr } : {}) } });
      });
      qr = payment.qr;
    } catch (error) {
      logFailure('Charge requires reconciliation', error);
      // Keep the reservation and return its access token, so a timeout never
      // strands the buyer or encourages a second charge for a new invoice.
    }
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
