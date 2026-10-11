import { NextResponse } from 'next/server';
import { releaseExpiredOrders } from '@/lib/stockCleaner';
import { verifyCronAuth } from '@/lib/auth';
import { logFailure, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!verifyCronAuth(req)) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Akses ditolak.' },
        { status: 401, headers: privateHeaders }
      );
    }

    const releasedCount = await releaseExpiredOrders();

    return NextResponse.json({
      success: true,
      message: `Berhasil membersihkan ${releasedCount} pesanan kedaluwarsa.`,
      releasedCount,
    }, { headers: privateHeaders });
  } catch (error: unknown) {
    logFailure('Cron cleanup failed', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses cleanup' }, { status: 500, headers: privateHeaders });
  }
}
