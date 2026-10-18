import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';
import { InputError, logFailure, pagination, pageResult, privateHeaders } from '@/lib/http';
import { OTP_REPLY_PREFIX, OTP_REQUEST_ACTION, resolveAppsOtpState } from '@/lib/appsOtp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const { limit, cursor } = pagination(req);
    const rows = await prisma.order.findMany({
      take: limit + 1, where: { removedFromAdminAt: null, ...(cursor ? { id: { lt: cursor } } : {}) }, orderBy: { id: 'desc' },
      select: {
        id: true, invoice: true, customerEmail: true, totalAmount: true, currency: true, pricingRegion: true,
        paymentMethod: true, status: true, type: true, createdAt: true, product: { select: { name: true } },
        audits: {
          where: { OR: [{ action: OTP_REQUEST_ACTION }, { action: { startsWith: OTP_REPLY_PREFIX } }] },
          orderBy: { id: 'desc' },
          take: 5,
          select: { action: true, createdAt: true },
        },
      },
    });
    const mapped = rows.map(({ audits, ...row }) => ({
      ...row,
      otp: row.type === 'APPS' && row.status === 'PAID' ? resolveAppsOtpState(audits, false) : null,
    }));
    return NextResponse.json({ success: true, ...pageResult(mapped, limit) }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status });
    logFailure('Order listing failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
