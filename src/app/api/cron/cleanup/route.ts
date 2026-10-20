import { NextResponse } from 'next/server';
import { releaseExpiredOrders } from '@/lib/stockCleaner';
import { verifyCronAuth } from '@/lib/auth';
import { logFailure, privateHeaders } from '@/lib/http';
import { purgeAppsDeliveries } from '@/lib/appsService';
import { purgeAppsReminderContacts } from '@/lib/appsReminders';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Akses ditolak.' },
        { status: 401, headers: privateHeaders }
      );
    }

    // Purge privacy data even when payment reconciliation needs review.
    const appsDeliveriesPurged = await purgeAppsDeliveries();
    const reminderContactsPurged = await purgeAppsReminderContacts();
    await prisma.aggregateMetric.deleteMany({ where: { day: { lt: new Date(Date.now() - 30 * 86400_000) } } });
    const releasedCount = await releaseExpiredOrders();
    await prisma.workerHeartbeat.upsert({ where: { name: 'cleanup' }, create: { name: 'cleanup', succeededAt: new Date() }, update: { succeededAt: new Date() } });

    return NextResponse.json({
      success: true,
      message: `Berhasil membersihkan ${releasedCount} pesanan kedaluwarsa.`,
      releasedCount,
      appsDeliveriesPurged,
      reminderContactsPurged,
    }, { headers: privateHeaders });
  } catch (error: unknown) {
    logFailure('Cron cleanup failed', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses cleanup' }, { status: 500, headers: privateHeaders });
  }
}
