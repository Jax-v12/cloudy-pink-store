import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutationError, requireCurrentSession } from '@/lib/adminMutation';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';
import { InputError, positiveInt, privateHeaders, readJson } from '@/lib/http';
import { validateOtpCode } from '@/lib/appsOtp';
import { isRejectedOtpReply, replyAppsOtp } from '@/lib/appsOtpServer';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!positiveInt(id)) throw new InputError();
    const body = await readJson(req, 1024);
    if (Object.keys(body).some(k => k !== 'code' && k !== 'requestId')) throw new InputError();
    const code = validateOtpCode(body.code);
    // Old admin pages without requestId must refresh; never bind a code to "the latest" request implicitly.
    if (!code || !positiveInt(body.requestId)) throw new InputError();

    const session = await adminAccess(req, true);
    const result = await replyAppsOtp({
      orderId: id, requestId: body.requestId, code, sessionId: session.id,
      beforeWrite: tx => requireCurrentSession(tx, session.id),
    });
    if (result.outcome === 'REQUEST_NOT_FOUND' || result.outcome === 'ORDER_INELIGIBLE') throw new CommerceError('ORDER_NOT_FOUND', 404);
    if (isRejectedOtpReply(result.outcome)) throw new CommerceError(`OTP_${result.outcome}`, 409);

    return NextResponse.json({ success: true, data: { ...result.state, code: null }, outcome: result.outcome }, { headers: privateHeaders });
  } catch (e) {
    return apiError(adminMutationError(e));
  }
}
