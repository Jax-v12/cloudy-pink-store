import { NextResponse } from 'next/server';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutation, adminMutationError, expectedTimestamp, requireCurrentSession } from '@/lib/adminMutation';
import { catalogAudit } from '@/lib/catalogLifecycle';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';
import { InputError, readJson, textField, positiveInt, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await adminAccess(req, true);
    const { id } = await params;
    const productId = Number(id);
    if (!/^\d+$/.test(id) || !positiveInt(productId)) throw new InputError();
    const body = await readJson(req, 4096);
    const name = textField(body.name, 100)!;
    const category = textField(body.category, 50, true);
    if (!positiveInt(body.price)) throw new InputError();
    const price = body.price;
    const expected = expectedTimestamp(body.expectedUpdatedAt ?? body.updatedAt);
    const data = await adminMutation('product-update', async tx => {
      await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${productId} FOR UPDATE`;
      await requireCurrentSession(tx, session.id);
      const existing = await tx.product.findUnique({ where: { id: productId } });
      if (!existing) throw new CommerceError('PRODUCT_NOT_FOUND', 404);
      if (existing.updatedAt.getTime() !== expected.getTime()) throw new CommerceError('PRODUCT_CHANGED');
      const saved = await tx.product.update({ where: { id: productId }, data: {
        name, price, ...(category ? { category } : {}),
      } });
      await catalogAudit(tx, saved, session.id, 'product-updated');
      return saved;
    });
    return NextResponse.json({ success: true, data }, { headers: privateHeaders });
  } catch (error) {
    return apiError(adminMutationError(error));
  }
}
