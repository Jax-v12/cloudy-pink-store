import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function verifyAdminAuth(req: Request, cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  const rawPassword = process.env.ADMIN_PASSWORD || '';
  const adminPassword = rawPassword.trim().replace(/^["']|["']$/g, '');
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD belum dikonfigurasi di environment server.');
  }
  const hashedAdminPassword = crypto.createHash('sha256').update(adminPassword).digest('hex');
  const sessionCookie = cookieStore.get('admin_session')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
  return sessionCookie === hashedAdminPassword || bearerToken === hashedAdminPassword;
}

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminAuth(req, cookieStore)) {
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
    const errMessage = error instanceof Error ? error.message : 'Gagal memuat analitik.';
    console.error('[Admin Analytics GET] Error:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}
