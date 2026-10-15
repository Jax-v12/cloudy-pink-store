import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recoverCheckoutPayment } from '@/lib/checkoutPayment';
import { consumeRateLimit } from '@/lib/rateLimit';
import { CommerceError } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { privateHeaders } from '@/lib/http';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';

// Ownership is checked before reconciliation or bounded, idempotent Login recovery.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const where = await invoiceAccessWhere(req, id, true);
    if (!where) throw new CommerceError('ORDER_NOT_FOUND', 404);
    const order = await prisma.order.findFirst({ where });
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);
    if (order.status !== 'PENDING') return NextResponse.json({ success: true }, { headers: privateHeaders });
    if (!await consumeRateLimit('payment-refresh', order.invoice, 1, 60_000)) return NextResponse.json({ success: true }, { headers: privateHeaders });
    await recoverCheckoutPayment(order);
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
