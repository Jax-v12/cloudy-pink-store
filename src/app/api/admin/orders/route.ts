import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { pagination, pageResult, privateHeaders } from '@/lib/http';
import { OTP_REPLY_PREFIX, OTP_REQUEST_ACTION, resolveAppsOtpState } from '@/lib/appsOtp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await adminAccess(req);
    const { limit, cursor } = pagination(req);
    const rows = await prisma.order.findMany({
      take: limit + 1, where: { removedFromAdminAt: null, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: 'desc' },
      select: {
        id: true, invoice: true, customerEmail: true, totalAmount: true, currency: true, pricingRegion: true,
        paymentMethod: true, status: true, type: true, accountStockId: true, refundStatus: true, createdAt: true, product: { select: { name: true } },
        audits: {
          where: { OR: [{ action: OTP_REQUEST_ACTION }, { action: { startsWith: OTP_REPLY_PREFIX } }] },
          orderBy: { id: 'desc' },
          take: 5,
          select: { id: true, action: true, createdAt: true },
        },
      },
    });
    const mapped = rows.map(({ audits, accountStockId, refundStatus, ...row }) => ({
      ...row,
      otp:
        row.type === 'APPS' && row.status === 'PAID' && accountStockId !== null && refundStatus === 'NONE'
          ? resolveAppsOtpState(audits, false)
          : null,
    }));
    return NextResponse.json({ success: true, ...pageResult(mapped, limit) }, { headers: privateHeaders });
  } catch (error) {
    return apiError(error);
  }
}
