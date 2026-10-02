import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';
import { InputError, readJson, textField, positiveInt, logFailure, privateHeaders } from '@/lib/http';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await verifyAdminAuth(req))) return NextResponse.json({ success: false }, { status: 401 });
    const { id } = await params;
    const productId = Number(id);
    if (!/^\d+$/.test(id) || !positiveInt(productId)) throw new InputError();
    const body = await readJson(req, 4096);
    const name = textField(body.name, 100)!;
    const category = textField(body.category, 50, true);
    if (!positiveInt(body.price)) throw new InputError();
    const existing = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false }, { status: 404 });
    const data = await prisma.product.update({ where: { id: productId }, data: {
      name, price: body.price, ...(category ? { category } : {}),
    } });
    return NextResponse.json({ success: true, data }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: 'INVALID_INPUT' }, { status: error.status });
    logFailure('Product update failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}
