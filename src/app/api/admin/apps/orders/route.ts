import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { InputError, pagination, pageResult, privateHeaders, readJson, positiveInt } from '@/lib/http';
import { appsOrderAction } from '@/lib/appsService';
import { adminAppsReminder } from '@/lib/appsReminders';

export async function GET(req: Request) {
  try {
    await adminAccess(req);
    const { limit, cursor } = pagination(req);
    const rows = await prisma.order.findMany({ where: { type: 'APPS', status: 'PAID', removedFromAdminAt: null,
      ...(cursor ? { id: { lt: cursor } } : {}), OR: [{ appsSupport: { isNot: null } }, { appsService: { is: { activeFrom: null } } }, { appsService: { is: { reminderOptIn: true, reminderVerifiedAt: null, activeUntil: { gt: new Date() } } } }] },
      take: limit + 1, orderBy: { id: 'desc' }, select: { id: true, invoice: true, productName: true, fulfillmentStatus: true,
        appsSnapshot: true, appsSupport: true, job: { select: { ownerSessionId: true } }, appsService: { select: { deliveredAt: true, acknowledgedAt: true, renewalOfOrderId: true, reminderOptIn: true, reminderVerifiedAt: true } } } });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}

export async function POST(req: Request) {
  try {
    const session = await adminAccess(req, true, true);
    const body = await readJson(req, 4096);
    if (!positiveInt(body.orderId) || !['claim', 'deliver', 'complete', 'support-status', 'contact', 'reminder-contact', 'reminder-verify'].includes(String(body.action)) ||
        Object.keys(body).some(k => !['orderId', 'action', 'delivery', 'evidence', 'supportStatus', 'consentAt'].includes(k))) throw new InputError();
    if (body.action === 'reminder-contact' || body.action === 'reminder-verify') {
      const data = await adminAppsReminder(body.orderId, session.id, body.action, body.evidence, body.consentAt);
      return NextResponse.json({ success: true, data }, { headers: privateHeaders });
    }
    const result = await appsOrderAction(body.orderId, { action: String(body.action), sessionId: session.id, delivery: body.delivery, evidence: body.evidence, supportStatus: body.supportStatus });
    return NextResponse.json({ success: true, data: result ?? null }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
