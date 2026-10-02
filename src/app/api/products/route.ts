import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logFailure } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        category: true,
        _count: {
          select: {
            stocks: {
              where: {
                status: 'READY',
              },
            },
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
      stockAvailable: product._count.stocks,
    }));

    return NextResponse.json({
      success: true,
      data: formattedProducts,
    });
  } catch (error: unknown) {
    logFailure('Product listing failed', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memuat produk' },
      { status: 500 }
    );
  }
}
