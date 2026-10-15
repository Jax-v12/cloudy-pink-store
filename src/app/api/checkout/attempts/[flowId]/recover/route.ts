import { NextResponse } from 'next/server';
import { recoverLoginAttempt } from '@/lib/checkoutAttempt';
import { attemptAccess, attemptError, onlyFields } from '@/lib/checkoutAttemptHttp';
import { privateHeaders, readJson } from '@/lib/http';

// POST because recovery may fence a late claimant; it is not a passive lookup.
export async function POST(req: Request, { params }: { params: Promise<{ flowId: string }> }) {
  try {
    const session = await attemptAccess(req, 'recover');
    onlyFields(await readJson(req, 256), []);
    const { flowId } = await params;
    const result = await recoverLoginAttempt(session.id, flowId);
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (error) { return attemptError(error); }
}
