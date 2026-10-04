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
  } catch (e) { return apiError(e); }
}
