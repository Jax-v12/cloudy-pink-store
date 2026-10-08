import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { checkoutPricing, checkoutQuoteToken } from '@/lib/checkoutPricing';
import { checkoutEnabled, CommerceError } from '@/lib/commerce';
import { resolveRequestRegion } from '@/lib/requestRegion';
import { apiError } from '@/lib/apiError';
import { InputError, readJson, positiveInt, privateHeaders } from '@/lib/http';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (Object.keys(body).some(k => !['productId', 'variantId', 'quantity', 'paymentMethod'].includes(k)) ||
        !positiveInt(body.productId) || !positiveInt(body.variantId) ||
        typeof body.paymentMethod !== 'string' || (body.quantity !== undefined && !positiveInt(body.quantity))) throw new InputError();
    if (!await consumeRateLimit('checkout-quote', clientKey(req), 120, 60_000)) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);
    const { region } = resolveRequestRegion(req);
    if (!region) throw new CommerceError('REGION_UNVERIFIED');
    const variant = await prisma.productVariant.findFirst({ where: { id: body.variantId, productId: body.productId, active: true, product: { type: 'ROBLOX', active: true } }, include: { product: true, regionalPrices: true } });
    if (!variant || !checkoutEnabled('ROBLOX')) throw new CommerceError('PRODUCT_UNAVAILABLE');
    const data = checkoutPricing('ROBLOX', variant.product.price, variant, region, body.paymentMethod, body.quantity as number | undefined);
    return NextResponse.json({ success: true, data: { ...data, quoteToken: checkoutQuoteToken(variant.productId, variant.id, data) } }, { headers: privateHeaders });
  } catch (error) { return apiError(error); }
}
