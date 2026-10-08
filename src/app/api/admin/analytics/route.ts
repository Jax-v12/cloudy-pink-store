import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';
import { logFailure, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const today = new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
    const midnight = new Date(`${today}T00:00:00+07:00`).getTime();
    const days = Array.from({ length: 7 }, (_, index) => new Date(midnight - (6 - index) * 86_400_000));
    // Database aggregates bound memory regardless of the number of paid orders.
    const [total, totalSold, chartData] = await Promise.all([
      prisma.order.aggregate({ where: { status: 'PAID', currency: 'IDR' }, _sum: { totalAmount: true } }),
      prisma.accountStock.count({ where: { status: 'SOLD' } }),
      Promise.all(days.map(async start => {
        const sum = await prisma.order.aggregate({
          where: { status: 'PAID', currency: 'IDR', createdAt: { gte: start, lt: new Date(start.getTime() + 86_400_000) } },
          _sum: { totalAmount: true },
        });
        return { date: start.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short' }), revenue: sum._sum.totalAmount || 0 };
      })),
    ]);
    return NextResponse.json({ success: true, data: { totalRevenue: total._sum.totalAmount || 0, totalSold, chartData } }, { headers: privateHeaders });
  } catch (error) {
    logFailure('Analytics failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
