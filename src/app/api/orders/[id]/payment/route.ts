import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { paymentAdapter } from '@/lib/paymentProvider';
import { applyPaymentStatus } from '@/lib/payments';
import { consumeRateLimit } from '@/lib/rateLimit';
import { CommerceError } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { privateHeaders } from '@/lib/http';

// Reconcile the existing invoice only. This endpoint never creates a second charge.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params; const token = req.headers.get('x-order-token');
    if (!token || token.length > 128 || id.length > 191) throw new CommerceError('ORDER_NOT_FOUND', 404);
    const order = await prisma.order.findFirst({ where: { invoice: id, accessToken: token } });
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);
    if (order.status !== 'PENDING') return NextResponse.json({ success: true }, { headers: privateHeaders });
    if (!await consumeRateLimit('payment-refresh', order.invoice, 1, 60_000)) return NextResponse.json({ success: true }, { headers: privateHeaders });
    const status = await paymentAdapter(order).status(order);
    if (status) {
      await applyPaymentStatus(order.id, status);
      const qr = status.qr;
      if (qr) await prisma.order.updateMany({ where: { id: order.id, status: 'PENDING' }, data: { qrisUrl: qr } });
    }
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
