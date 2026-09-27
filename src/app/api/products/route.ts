import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          where: {
            status: 'READY',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedProducts = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      category: product.category,
      stockAvailable: product.stocks.length,
    }));

    return NextResponse.json({
      success: true,
      data: formattedProducts,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memuat produk';
    console.error('Error fetch products:', errMessage);
    return NextResponse.json(
      { success: false, message: errMessage },
      { status: 500 }
    );
  }
}