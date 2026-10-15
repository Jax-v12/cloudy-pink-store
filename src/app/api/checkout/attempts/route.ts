import { NextResponse } from 'next/server';
import { openLoginAttempt, validFlowId } from '@/lib/checkoutAttempt';
import { attemptAccess, attemptError, onlyFields } from '@/lib/checkoutAttemptHttp';
import { InputError, positiveInt, privateHeaders, readJson } from '@/lib/http';

export async function POST(req: Request) {
  try {
    const session = await attemptAccess(req, 'open');
    const body = await readJson(req, 1024);
    onlyFields(body, ['flowId', 'productId', 'variantId', 'previousFlowId']);
    const { flowId, productId, variantId, previousFlowId } = body;
    if (!validFlowId(flowId) || !positiveInt(productId) || !positiveInt(variantId) ||
        (previousFlowId !== undefined && !validFlowId(previousFlowId))) throw new InputError();
    const result = await openLoginAttempt(session.id, { flowId, productId, variantId, previousFlowId });
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (error) { return attemptError(error); }
}
