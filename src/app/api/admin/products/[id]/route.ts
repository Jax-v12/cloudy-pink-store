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

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminAuth(req, cookieStore)) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak (Unauthorized).' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json(
        { success: false, message: 'ID produk tidak valid.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, price, category } = body;

    if (!name || price === undefined || price === null) {
      return NextResponse.json(
        { success: false, message: 'Nama dan harga produk wajib diisi.' },
        { status: 400 }
      );
    }

    const parsedPrice = Math.round(Number(price));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json(
        { success: false, message: 'Harga harus berupa angka bulat positif.' },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({ where: { id: productId } });
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Produk tidak ditemukan.' },
        { status: 404 }
      );
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        name: String(name).trim().slice(0, 100),
        price: parsedPrice,
        category: category ? String(category).trim().slice(0, 50) : existing.category,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Produk berhasil diperbarui.',
      data: updated,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memperbarui produk.';
    console.error('[Admin Products PUT] Error:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}
