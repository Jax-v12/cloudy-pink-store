import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { InputError, readJson, logFailure } from '@/lib/http';
import { verifySignature, getGatewayStatus } from '@/lib/midtrans';
import { applyPaymentStatus } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (!verifySignature(body)) return NextResponse.json({ message: 'Invalid signature' }, { status: 403 });
    const order = await prisma.order.findUnique({
      where: { invoice: body.order_id as string }, select: { id: true, invoice: true, totalAmount: true },
    });
    if (!order) return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    if (Number(body.gross_amount) !== order.totalAmount) return NextResponse.json({ message: 'Amount mismatch' }, { status: 400 });
    const status = await getGatewayStatus(order.invoice, order.totalAmount);
    if (!status) throw new Error('GATEWAY_STATUS_UNAVAILABLE');
    await applyPaymentStatus(order.id, status);
    return NextResponse.json({ message: 'Processed successfully' });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ message: 'Invalid payload' }, { status: error.status });
    logFailure('Payment reconciliation failed', error);
    // A failed transaction is not an acknowledgement; allow the gateway to retry.
    return NextResponse.json({ message: 'Reconciliation required' }, { status: 503 });
  }
}
