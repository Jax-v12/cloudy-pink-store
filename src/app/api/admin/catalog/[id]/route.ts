import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutationError, databaseCode, expectedTimestamp } from '@/lib/adminMutation';
import { deleteCatalogProduct, setCatalogProductActive } from '@/lib/catalogLifecycle';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';
import { InputError, positiveInt, readJson, privateHeaders } from '@/lib/http';

type Context = { params: Promise<{ id: string }> };
async function mutate(req: Request, context: Context, deleting: boolean) {
  try {
    const session = await adminAccess(req, true, deleting);
    const rawId = (await context.params).id; const id = Number(rawId);
    if (!/^\d+$/.test(rawId) || !positiveInt(id)) throw new InputError();
    const body = await readJson(req, 4096);
    const allowed = deleting ? ['confirmationName', 'expectedUpdatedAt'] : ['active', 'expectedUpdatedAt'];
    if (Object.keys(body).some(key => !allowed.includes(key))) throw new InputError();
    const expected = expectedTimestamp(body.expectedUpdatedAt);
    if (deleting) {
      if (typeof body.confirmationName !== 'string' || !body.confirmationName.length || body.confirmationName.length > 100) throw new InputError();
      const data = await deleteCatalogProduct(id, session.id, body.confirmationName, expected);
      return NextResponse.json({ success: true, data }, { headers: privateHeaders });
    }
    if (typeof body.active !== 'boolean') throw new InputError();
    const data = await setCatalogProductActive(id, session.id, body.active, expected);
    return NextResponse.json({ success: true, data }, { headers: privateHeaders });
  } catch (error) {
    return apiError(databaseCode(error) === 'P2003' ? new CommerceError('PRODUCT_HAS_DEPENDENCIES') : adminMutationError(error));
  }
}
export const DELETE = (req: Request, context: Context) => mutate(req, context, true);
export const PATCH = (req: Request, context: Context) => mutate(req, context, false);
