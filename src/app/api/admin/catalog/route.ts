import { NextResponse } from 'next/server';
import { RobloxMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { InputError, readJson, textField, positiveInt, pagination, pageResult, privateHeaders } from '@/lib/http';
import { ROBLOX_MAX_GAMEPASS_UNITS, robloxGamepassPrice } from '@/lib/roblox';

export async function GET(req: Request) {
  try {
    await adminAccess(req);
    const { limit, cursor } = pagination(req);
    const rows = await prisma.product.findMany({ where: { type: { not: 'APPS' }, ...(cursor ? { id: { lt: cursor } } : {}) }, take: limit + 1, orderBy: { id: 'desc' }, include: { variants: { orderBy: { id: 'asc' } } } });
    return NextResponse.json({ success: true, ...pageResult(rows, limit) }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}

export async function POST(req: Request) {
  try {
    await adminAccess(req, true);
    const body = await readJson(req);
    if (body.kind === 'product') {
      const name = textField(body.name, 100)!; const slug = textField(body.slug, 100)!;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !['GAME', 'ROBLOX'].includes(String(body.type)) || typeof body.active !== 'boolean') throw new InputError();
      const coverImage = textField(body.coverImage, 500, true);
      if (coverImage && !/^\/[A-Za-z0-9/_.-]+$/.test(coverImage)) throw new InputError();
      const data = { name, slug, type: body.type as 'GAME' | 'ROBLOX', active: body.active, coverImage, price: 0 };
      if (body.id !== undefined && !positiveInt(body.id)) throw new InputError();
      const result = await prisma.$transaction(async tx => {
        if (body.id) {
          const existing = await tx.product.findUnique({ where: { id: body.id as number } });
          if (!existing || existing.type !== data.type) throw new InputError();
          return tx.product.update({ where: { id: existing.id }, data });
        }
        return tx.product.create({ data });
      });
      return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
    }
    if (body.kind !== 'variant' || !positiveInt(body.productId) || !positiveInt(body.price) || !positiveInt(body.units) || typeof body.active !== 'boolean') throw new InputError();
    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product || product.type === 'APPS') throw new InputError();
    const method = product.type === 'ROBLOX' ? body.method as RobloxMethod : null;
    if (product.type === 'ROBLOX' && !Object.values(RobloxMethod).includes(method!)) throw new InputError();
    if (method === 'GAMEPASS' && (body.units as number) > ROBLOX_MAX_GAMEPASS_UNITS) throw new InputError();
    if (method === 'GIFT_USERNAME' && body.active && body.capacityConfirmed !== true) throw new InputError();
    const providerSku = product.type === 'GAME' ? textField(body.providerSku, 100)! : null;
    const data = { productId: product.id, name: textField(body.name, 100)!, price: body.price, units: body.units,
      active: body.active, method, gamepassPrice: method === 'GAMEPASS' ? robloxGamepassPrice(body.units as number) : null,
      providerSku, requiresZone: body.requiresZone === true,
      capacityCheckedAt: method === 'GIFT_USERNAME' && body.capacityConfirmed === true ? new Date() : null };
    if (body.id !== undefined && !positiveInt(body.id)) throw new InputError();
    const result = await prisma.$transaction(async tx => {
      if (body.id) {
        const existing = await tx.productVariant.findUnique({ where: { id: body.id as number } });
        if (!existing || existing.productId !== product.id) throw new InputError();
        return tx.productVariant.update({ where: { id: existing.id }, data });
      }
      return tx.productVariant.create({ data });
    });
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
