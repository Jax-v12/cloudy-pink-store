import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak (Unauthorized).' },
        { status: 401 }
      );
    }

    // 1. Total Revenue (PAID orders)
    const totalRevenueAggr = await prisma.order.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: 'PAID',
      },
    });
    const totalRevenue = totalRevenueAggr._sum.totalAmount || 0;

    // 2. Total Sold (SOLD accounts)
    const totalSold = await prisma.accountStock.count({
      where: {
        status: 'SOLD',
      },
    });

    // 3. Time-series for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const recentOrders = await prisma.order.findMany({
      where: {
        status: 'PAID',
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by date (DD MMM format)
    const dailyData: Record<string, number> = {};

    // Initialize the last 7 days with 0 revenue
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dailyData[dateString] = 0;
    }

    recentOrders.forEach(order => {
      const dateString = order.createdAt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      if (dailyData[dateString] !== undefined) {
        dailyData[dateString] += order.totalAmount;
      }
    });

    const chartData = Object.keys(dailyData).map(date => ({
      date,
      revenue: dailyData[date],
    }));

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue,
        totalSold,
        chartData,
      },
    });
  } catch (error: unknown) {
    console.error('[Admin Analytics GET] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat analitik.' }, { status: 500 });
  }
}
