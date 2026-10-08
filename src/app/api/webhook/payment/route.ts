import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InputError, readJson, logFailure } from '@/lib/http';
import { verifySignature } from '@/lib/midtrans';
import { paymentAdapter } from '@/lib/paymentProvider';
import { applyPaymentStatus } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (!verifySignature(body)) return NextResponse.json({ message: 'Invalid signature' }, { status: 403 });
    const order = await prisma.order.findUnique({
      where: { invoice: body.order_id as string },
    });
    if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    if (order.paymentProvider !== 'MIDTRANS' || order.currency !== 'IDR' || order.pricingRegion !== 'ID' ||
        (body.currency !== undefined && body.currency !== order.currency) ||
        (order.paymentReference && body.transaction_id !== undefined && body.transaction_id !== order.paymentReference)) return NextResponse.json({ message: 'Payment mismatch' }, { status: 400 });
    if (Number(body.gross_amount) !== order.totalAmount) return NextResponse.json({ message: 'Amount mismatch' }, { status: 400 });
    const status = await paymentAdapter(order).status(order);
    if (!status) throw new Error('GATEWAY_STATUS_UNAVAILABLE');
    if (body.transaction_id !== undefined && body.transaction_id !== status.reference) throw new Error('PAYMENT_REFERENCE_MISMATCH');
    await applyPaymentStatus(order.id, status);
    return NextResponse.json({ message: 'Processed successfully' });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ message: 'Invalid payload' }, { status: error.status });
    logFailure('Payment reconciliation failed', error);
    // A failed transaction is not an acknowledgement; allow the gateway to retry.
    return NextResponse.json({ message: 'Reconciliation required' }, { status: 503 });
  }
}
