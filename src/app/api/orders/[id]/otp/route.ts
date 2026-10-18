import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { privateHeaders } from '@/lib/http';
import { sendTelegramNotification } from '@/lib/telegram';
import { requestAppsOtp } from '@/lib/appsOtpServer';
import { otpRequestNotification } from '@/lib/telegramWebhook';
import { apiError } from '@/lib/apiError';
import { adminMutationError } from '@/lib/adminMutation';
import { CommerceError } from '@/lib/commerce';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const where = await invoiceAccessWhere(req, id, true);
    if (!where) throw new CommerceError('ORDER_NOT_FOUND', 404);

    // Authorization only; eligibility is re-checked under the order lock.
    const order = await prisma.order.findFirst({ where, select: { id: true } });
    if (!order) throw new CommerceError('ORDER_NOT_FOUND', 404);

    const allowed = await consumeRateLimit('apps-otp', `${order.id}:${clientKey(req)}`, 3, 10 * 60_000);
    if (!allowed) throw new CommerceError('RATE_LIMIT_EXCEEDED', 429);

    const result = await requestAppsOtp(order.id);
    // Network call only after commit; a repeated click on an active request sends nothing.
    if (result.created && result.state.requestId) {
      await sendTelegramNotification(otpRequestNotification(result.invoice, result.state.requestId, result.totalAmount));
    }

    return NextResponse.json({ success: true, data: result.state }, { headers: privateHeaders });
  } catch (error) {
    return apiError(adminMutationError(error));
  }
}
