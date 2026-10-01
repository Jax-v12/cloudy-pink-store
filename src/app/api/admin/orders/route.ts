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

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10) || 50;
    const cursorStr = searchParams.get('cursor');
    const cursor = cursorStr ? parseInt(cursorStr, 10) : null;

    const orders = await prisma.order.findMany({
      take: limit + 1,
      ...(cursor && !isNaN(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        invoice: true,
        customerEmail: true,
        totalAmount: true,
        status: true,
        qrisUrl: true,
        createdAt: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    let nextCursor: number | null = null;
    if (orders.length > limit) {
      const nextItem = orders.pop();
      nextCursor = nextItem!.id;
    }

    return NextResponse.json({
      success: true,
      data: orders,
      pagination: { nextCursor },
    });
  } catch (error: unknown) {
    console.error('[Admin Orders GET] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat riwayat transaksi.' }, { status: 500 });
  }
}
