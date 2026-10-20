import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { requireCurrentSession } from '@/lib/adminMutation';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/apiError';
import { InputError, pagination, pageResult, privateHeaders, readJson, positiveInt } from '@/lib/http';
import { CommerceError } from '@/lib/commerce';

export async function GET(req: Request) {
  try {
    await adminAccess(req); const { limit, cursor } = pagination(req);
    const rows = await prisma.appsReminder.findMany({ where: { status: { in: ['UNKNOWN', 'REJECTED'] }, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' }, take: limit + 1, select: { id: true, orderId: true, daysBefore: true, periodEnd: true, status: true, attemptedAt: true } });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
export async function POST(req: Request) {
  try {
    const session = await adminAccess(req, true, true); const body = await readJson(req, 512);
    if (!positiveInt(body.orderId) || !positiveInt(body.id) || typeof body.evidence !== 'string' || !/^[A-Za-z0-9:_-]{1,100}$/.test(body.evidence) || Object.keys(body).some(k => !['orderId', 'id', 'evidence'].includes(k))) throw new InputError();
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id=${body.orderId} FOR UPDATE`;
      await requireCurrentSession(tx, session.id, true);
      // Allow an in-flight attempt to finish before its disposition can change.
      const row = await tx.appsReminder.findFirst({ where: { id: body.id as number, orderId: body.orderId as number, status: { in: ['UNKNOWN', 'REJECTED'] }, attemptedAt: { lte: new Date(Date.now() - 60000) } } });
      if (!row) throw new CommerceError('INVALID_TRANSITION');
      await tx.appsReminder.update({ where: { id: row.id }, data: { status: 'REVIEWED' } });
      await tx.adminAudit.create({ data: { orderId: row.orderId, sessionId: session.id, action: `apps-reminder-reviewed-${row.daysBefore}:${body.evidence}` } });
    });
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
