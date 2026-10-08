import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';
import { InputError, logFailure, pagination, pageResult, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const { limit, cursor } = pagination(req);
    const rows = await prisma.order.findMany({
      take: limit + 1, ...(cursor ? { where: { id: { lt: cursor } } } : {}), orderBy: { id: 'desc' },
      select: { id: true, invoice: true, customerEmail: true, totalAmount: true, currency: true, pricingRegion: true,
        status: true, createdAt: true, product: { select: { name: true } } },
    });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status });
    logFailure('Order listing failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
