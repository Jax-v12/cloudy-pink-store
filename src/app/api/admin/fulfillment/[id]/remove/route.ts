import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutationError } from '@/lib/adminMutation';
import { apiError } from '@/lib/apiError';
import { setOrderRemovedFromAdmin } from '@/lib/orderArchive';
import { InputError, positiveInt, readJson, privateHeaders } from '@/lib/http';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await adminAccess(req, true);
    const rawId = (await params).id; const id = Number(rawId);
    if (!/^\d+$/.test(rawId) || !positiveInt(id)) throw new InputError();
    const body = await readJson(req, 4096);
    if (typeof body.removed !== 'boolean' || Object.keys(body).some(key => !['removed', 'confirmationInvoice'].includes(key))) throw new InputError();
    if (body.removed && (typeof body.confirmationInvoice !== 'string' || !body.confirmationInvoice.length || body.confirmationInvoice.length > 191)) throw new InputError();
    if (!body.removed && body.confirmationInvoice !== undefined) throw new InputError();
    if (body.removed) await adminAccess(req, true, true);
    const data = await setOrderRemovedFromAdmin(id, session.id, body.removed, body.confirmationInvoice as string | undefined);
    return NextResponse.json({ success: true, data }, { headers: privateHeaders });
  } catch (error) { return apiError(adminMutationError(error)); }
}
