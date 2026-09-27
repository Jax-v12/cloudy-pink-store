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

    const orders = await prisma.order.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: orders,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memuat riwayat transaksi.';
    console.error('[Admin Orders GET] Error:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}
