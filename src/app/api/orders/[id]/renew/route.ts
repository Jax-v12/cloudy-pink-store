import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';
import { createCheckout } from '@/lib/checkout';
import { initializeCheckoutPayment } from '@/lib/checkoutPayment';
import { CommerceError, requestDigest } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { privateHeaders, readJson, InputError } from '@/lib/http';
import { parseAppsConfig } from '@/lib/appsProduct';
import { consumeRateLimit, clientKey } from '@/lib/rateLimit';
import { resolveRequestRegion } from '@/lib/requestRegion';

async function renewalSource(req: Request, invoice: string) {
  const where = await invoiceAccessWhere(req, invoice, req.method === 'POST');
  const source = where ? await prisma.order.findFirst({ where: { ...where, type: 'APPS', status: 'PAID', refundStatus: 'NONE' }, include: { appsService: true, product: true } }) : null;
  if (!source?.appsService?.activeFrom || !source.product.active || parseAppsConfig(source.product.appsConfig)?.fulfillmentMode !== 'ACTIVATION' || parseAppsConfig(source.appsSnapshot)?.fulfillmentMode !== 'ACTIVATION') throw new CommerceError('ORDER_NOT_FOUND', 404);
  return source;
}
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const source = await renewalSource(req, (await params).id); const p = source.product;
    if (!resolveRequestRegion(req).region) throw new CommerceError('REGION_UNVERIFIED');
    return NextResponse.json({ success: true, data: { name: p.name, price: p.price, appsConfig: parseAppsConfig(p.appsConfig),
      appsPolicyToken: requestDigest({ productId: p.id, price: p.price, appsConfig: parseAppsConfig(p.appsConfig) }) } }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const source = await renewalSource(req, (await params).id);
    if (!await consumeRateLimit('apps-renewal', clientKey(req), 5, 3600_000)) throw new CommerceError('RATE_LIMITED', 429);
    const body = await readJson(req, 1024);
    if (Object.keys(body).some(k => k !== 'appsPolicyToken')) throw new InputError();
    const { order, created } = await createCheckout({ productId: source.productId, customerEmail: source.customerEmail, appsPolicyToken: body.appsPolicyToken },
      req.headers.get('idempotency-key') || '', resolveRequestRegion(req).region, undefined, false, source.id);
    const qr = created ? await initializeCheckoutPayment(order, source.customerEmail) : order.qrisUrl;
    return NextResponse.json({ success: true, data: { invoice: order.invoice, accessToken: order.accessToken } }, { status: qr ? 200 : 202, headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
