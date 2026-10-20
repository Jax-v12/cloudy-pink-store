import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { prisma } from '@/lib/prisma';
import { privateHeaders } from '@/lib/http';
import { apiError } from '@/lib/apiError';

export async function GET(req: Request) {
  try {
    await adminAccess(req);
    const since = new Date(Date.now() - 30 * 86400_000);
    const [observations, paid] = await Promise.all([
      prisma.aggregateMetric.groupBy({ by: ['area', 'metric', 'bucket'], where: { day: { gte: since } }, _sum: { count: true } }),
      prisma.order.groupBy({ by: ['type'], where: { paidAt: { gte: since }, status: 'PAID' }, _count: { id: true } }),
    ]);
    return NextResponse.json({ success: true, data: { observations, paid } }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
