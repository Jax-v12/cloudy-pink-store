import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { invoiceAccessWhere } from '@/lib/invoiceAccess';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { privateHeaders } from '@/lib/http';
import { sendTelegramNotificationOutcome } from '@/lib/telegram';
import { requestAppsOtp, markAppsOtpNotified, markAppsOtpRejected } from '@/lib/appsOtpServer';
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
    // Network call only after commit; retries are bounded to the same requestId until notified.
    if (result.shouldNotify && result.state.requestId) {
      const outcome = await sendTelegramNotificationOutcome(
        otpRequestNotification(result.invoice, result.state.requestId, result.totalAmount),
      );
      try {
        if (outcome === 'SENT') await markAppsOtpNotified(order.id, result.state.requestId);
        else if (outcome === 'REJECTED' && result.notificationAttempt) await markAppsOtpRejected(order.id, result.state.requestId, result.notificationAttempt);
      } catch { console.error('APPS_OTP_NOTIFICATION_ACK_FAILED'); }
    }

    return NextResponse.json({ success: true, data: result.state }, { headers: privateHeaders });
  } catch (error) {
    return apiError(adminMutationError(error));
  }
}
