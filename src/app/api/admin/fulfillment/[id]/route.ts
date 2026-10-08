import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { InputError, positiveInt, readJson, textField, privateHeaders } from '@/lib/http';
import { CommerceError } from '@/lib/commerce';
import { manualAction } from '@/lib/manualFulfillment';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!positiveInt(id)) throw new InputError();
    const body = await readJson(req, 4096);
    const action = textField(body.action, 32)!;
    const session = await adminAccess(req, true);
    if (action === 'reveal') throw new CommerceError('CREDENTIAL_ACCESS_REMOVED', 410);
    await manualAction(id, session.id, action, textField(body.evidence, 1000, true) || undefined);
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) {
    const err = e as { code?: string };
    if (err && typeof err === 'object' && typeof err.code === 'string' && err.code.startsWith('P')) {
      console.error(`[Fulfillment] Prisma Database Error: ${err.code}`);
      return NextResponse.json({ success: false, errorCode: 'DATABASE_ERROR' }, { status: 500, headers: privateHeaders });
    }
    return apiError(e);
  }
}
