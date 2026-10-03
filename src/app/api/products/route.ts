import { NextResponse } from 'next/server';
import { ProductType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkoutEnabled } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { InputError, pagination, pageResult } from '@/lib/http';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const type = q.get('type') || 'APPS';
    if (!Object.values(ProductType).includes(type as ProductType)) throw new InputError();
    const { limit, cursor } = pagination(req);
    const rows = await prisma.product.findMany({ where: { type: type as ProductType, active: true,
      ...(q.get('slug') ? { slug: q.get('slug')! } : {}), ...(cursor ? { id: { lt: cursor } } : {}) },
      take: limit + 1, orderBy: { id: 'desc' }, select: {
        id: true, name: true, slug: true, price: true, type: true, category: true, coverImage: true,
        variants: { where: { active: true }, orderBy: { price: 'asc' }, select: { id: true, name: true, price: true, units: true, method: true, gamepassPrice: true, requiresZone: true } },
        _count: { select: { stocks: { where: { status: 'READY', order: null } } } },
      },
    });
    const page = pageResult(rows, limit);
    return NextResponse.json({ success: true, ...page, data: page.data.map(({ _count, ...p }) => ({ ...p,
      stockAvailable: _count.stocks, checkoutEnabled: checkoutEnabled(p.type),
    })) }, { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15' } });
  } catch (e) { return apiError(e); }
}
