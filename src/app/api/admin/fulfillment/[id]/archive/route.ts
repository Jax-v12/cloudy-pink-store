import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutationError } from '@/lib/adminMutation';
import { apiError } from '@/lib/apiError';
import { setOrderArchived } from '@/lib/orderArchive';
import { InputError, positiveInt, readJson, privateHeaders } from '@/lib/http';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await adminAccess(req, true);
    const rawId = (await params).id; const id = Number(rawId);
    if (!/^\d+$/.test(rawId) || !positiveInt(id)) throw new InputError();
    const body = await readJson(req, 4096);
    if (typeof body.archived !== 'boolean' || Object.keys(body).some(key => key !== 'archived')) throw new InputError();
    const data = await setOrderArchived(id, session.id, body.archived);
    return NextResponse.json({ success: true, data }, { headers: privateHeaders });
  } catch (error) { return apiError(adminMutationError(error)); }
}
