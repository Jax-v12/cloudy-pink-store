import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutation, adminMutationError, requireCurrentSession } from '@/lib/adminMutation';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';
import { InputError, positiveInt, privateHeaders, readJson } from '@/lib/http';
import { encodeOtpReplyAction, OTP_TTL_MS, validateOtpCode } from '@/lib/appsOtp';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!positiveInt(id)) throw new InputError();
    const body = await readJson(req, 1024);
    if (Object.keys(body).some(k => k !== 'code')) throw new InputError();
    const code = validateOtpCode(body.code);
    if (!code) throw new InputError();

    const session = await adminAccess(req, true);
    const data = await adminMutation('apps-otp-reply', async tx => {
      await tx.$queryRaw`SELECT id FROM \`Order\` WHERE id = ${id} FOR UPDATE`;
      await requireCurrentSession(tx, session.id);
      const order = await tx.order.findUnique({
        where: { id },
        select: { id: true, type: true, status: true, accountStockId: true, removedFromAdminAt: true },
      });
      if (!order || order.removedFromAdminAt || order.type !== 'APPS' || order.status !== 'PAID' || order.accountStockId === null) {
        throw new CommerceError('ORDER_NOT_FOUND', 404);
      }
      const audit = await tx.adminAudit.create({
        data: { orderId: order.id, sessionId: session.id, action: encodeOtpReplyAction(code) },
      });
      return {
        status: 'DELIVERED' as const,
        code: null,
        updatedAt: audit.createdAt.toISOString(),
        expiresAt: new Date(audit.createdAt.getTime() + OTP_TTL_MS).toISOString(),
      };
    });

    return NextResponse.json({ success: true, data }, { headers: privateHeaders });
  } catch (e) {
    return apiError(adminMutationError(e));
  }
}
