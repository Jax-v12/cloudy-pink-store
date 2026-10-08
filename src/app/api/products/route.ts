import { NextResponse } from 'next/server';
import { ProductType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { checkoutEnabled } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { InputError, pagination, pageResult, privateHeaders } from '@/lib/http';
import { paymentMethods } from '@/lib/paymentProvider';
import { resolveRequestRegion } from '@/lib/requestRegion';
import { regionalAmount, REGION_CURRENCY } from '@/lib/regionalPricing';

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
        variants: { where: { active: true }, orderBy: { price: 'asc' }, select: { id: true, name: true, price: true, units: true, maxUnits: true, unitStep: true, method: true, gamepassPrice: true, requiresZone: true, regionalPrices: { select: { region: true, amount: true, active: true } } } },
        _count: { select: { stocks: { where: { status: 'READY', order: null } } } },
      },
    });
    const page = pageResult(rows, limit);
    const location = resolveRequestRegion(req);
    const region = location.region;
    const methods = region ? paymentMethods(region) : [];
    return NextResponse.json({ success: true, ...page, location, paymentMethods: methods, data: page.data.map(({ _count, ...p }) => ({ ...p,
      ...(p.type === 'ROBLOX' ? { price: null, currency: region ? REGION_CURRENCY[region] : null,
        variants: p.variants.map(v => ({ ...v, price: region ? regionalAmount(v, region) : null,
          regionalPrices: region ? v.regionalPrices.filter(row => row.region === region) : [] })) } : {}),
      stockAvailable: _count.stocks, checkoutEnabled: checkoutEnabled(p.type) && (p.type !== 'ROBLOX' || Boolean(region && methods.length)),
    })) }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
