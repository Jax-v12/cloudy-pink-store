import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';
import { InputError, readJson, privateHeaders } from '@/lib/http';
import { CommerceError } from '@/lib/commerce';
import { apiError } from '@/lib/apiError';
import { consumeRateLimit, clientKey } from '@/lib/rateLimit';
import { appsOrderAction } from '@/lib/appsService';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const where = await invoiceAccessWhere(req, (await params).id, true);
    const order = where ? await prisma.order.findFirst({ where: { ...where, type: 'APPS' }, select: { id: true } }) : null;
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);
    if (!await consumeRateLimit('apps-invoice-action', `${clientKey(req)}:${order.id}`, 8, 60000)) throw new CommerceError('RATE_LIMITED', 429);
    const body = await readJson(req, 1024);
    if (!['support', 'acknowledge'].includes(String(body.action)) || Object.keys(body).some(k => !['action', 'reason'].includes(k))) throw new InputError();
    await appsOrderAction(order.id, { action: String(body.action), reason: body.reason });
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
