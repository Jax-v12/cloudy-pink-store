import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { adminMutation, requireCurrentSession } from '@/lib/adminMutation';
import { apiError } from '@/lib/apiError';
import { InputError, pagination, pageResult, privateHeaders, readJson, textField, positiveInt } from '@/lib/http';
import { parseAppsConfig } from '@/lib/appsProduct';
import { catalogAudit } from '@/lib/catalogLifecycle';

export async function GET(req: Request) {
  try {
    await adminAccess(req); const { limit, cursor } = pagination(req);
    const rows = await prisma.product.findMany({ where: { type: 'APPS', ...(cursor ? { id: { lt: cursor } } : {}) }, take: limit + 1, orderBy: { id: 'desc' },
      select: { id: true, name: true, slug: true, price: true, category: true, active: true, appsConfig: true, updatedAt: true } });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}

export async function POST(req: Request) {
  try {
    const session = await adminAccess(req, true); const body = await readJson(req, 16384);
    if (Object.keys(body).some(k => !['id', 'name', 'slug', 'price', 'category', 'active', 'appsConfig', 'updatedAt'].includes(k)) ||
        (body.id !== undefined && !positiveInt(body.id)) || typeof body.active !== 'boolean' || !Number.isSafeInteger(body.price) || Number(body.price) < 0 || Number(body.price) > 2147483647) throw new InputError();
    const name = textField(body.name, 100)!; const slug = textField(body.slug, 100)!; const category = textField(body.category, 50)!;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new InputError();
    const config = parseAppsConfig(body.appsConfig);
    const active = body.active;
    if (body.active && (!positiveInt(body.price) || !config)) throw new InputError();
    await adminMutation('apps-product-save', async tx => {
      if (body.id) {
        await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${body.id as number} FOR UPDATE`;
        const prior = await tx.product.findUnique({ where: { id: body.id as number } });
        if (!prior || prior.type !== 'APPS' || typeof body.updatedAt !== 'string' || prior.updatedAt.toISOString() !== body.updatedAt) throw new InputError(409);
      }
      await requireCurrentSession(tx, session.id);
      const data = { name, slug, price: Number(body.price), category, active, appsConfig: config ?? Prisma.DbNull };
      const saved = body.id ? await tx.product.update({ where: { id: body.id as number }, data }) : await tx.product.create({ data: { ...data, type: 'APPS' } });
      await catalogAudit(tx, saved, session.id, 'apps-product-saved');
    });
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
