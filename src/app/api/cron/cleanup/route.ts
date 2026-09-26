import { NextResponse } from 'next/server';
import { releaseExpiredOrders } from '@/lib/stockCleaner';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const secret = process.env.CRON_SECRET;

    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized: Akses ditolak.' },
        { status: 401 }
      );
    }

    const releasedCount = await releaseExpiredOrders();

    return NextResponse.json({
      success: true,
      message: `Berhasil membersihkan ${releasedCount} pesanan kedaluwarsa.`,
      releasedCount,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memproses cleanup';
    console.error('Cron cleanup error:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}