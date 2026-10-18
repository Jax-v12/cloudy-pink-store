import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { privateHeaders } from '@/lib/http';
import { sendTelegramNotification } from '@/lib/telegram';
import { OTP_REQUEST_ACTION, OTP_TTL_MS } from '@/lib/appsOtp';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const where = await invoiceAccessWhere(req, id, true);
    if (!where) throw new CommerceError('ORDER_NOT_FOUND', 404);

    const order = await prisma.order.findFirst({
      where,
      select: { id: true, invoice: true, totalAmount: true, type: true, status: true, accountStockId: true },
    });
    if (!order || order.type !== 'APPS' || order.status !== 'PAID' || order.accountStockId === null) {
      throw new CommerceError('ORDER_NOT_FOUND', 404);
    }

    const allowed = await consumeRateLimit('apps-otp', `${order.id}:${clientKey(req)}`, 3, 10 * 60_000);
    if (!allowed) {
      throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
    }

    const audit = await prisma.adminAudit.create({
      data: { orderId: order.id, sessionId: 'customer-otp', action: OTP_REQUEST_ACTION },
    });

    await sendTelegramNotification(`Invoice: ${order.invoice}\nTotal: ${order.totalAmount}\nStatus: OTP_REQUESTED`);

    return NextResponse.json({
      success: true,
      data: {
        status: 'REQUESTED' as const,
        code: null,
        updatedAt: audit.createdAt.toISOString(),
        expiresAt: new Date(audit.createdAt.getTime() + OTP_TTL_MS).toISOString(),
      },
    }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}
