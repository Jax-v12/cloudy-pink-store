import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await verifyAdminAuth(req))) {
      return NextResponse.json(
        { success: false, message: 'Akses ditolak (Unauthorized).' },
        { status: 401 }
      );
    }

    const { id } = await params;
    
    if (!/^\d+$/.test(id)) {
      return NextResponse.json(
        { success: false, message: 'ID produk tidak valid.' },
        { status: 400 }
      );
    }
    const productId = parseInt(id, 10);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }
    
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const { name, price, category } = body;

    if (typeof name !== 'string' || !name.trim() || typeof price !== 'number') {
      return NextResponse.json(
        { success: false, message: 'Nama dan harga produk wajib diisi dengan format yang benar.' },
        { status: 400 }
      );
    }

    const parsedPrice = Math.round(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
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
    console.error('[Admin Products PUT] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memperbarui produk.' }, { status: 500 });
  }
}
