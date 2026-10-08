import { NextResponse } from 'next/server';
import { quoteRobloxQuantity } from '@/lib/robloxPricing';
import { RobloxMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { adminAccess } from '@/lib/adminAccess';
import { apiError } from '@/lib/apiError';
import { InputError, readJson, textField, positiveInt, pagination, pageResult, privateHeaders } from '@/lib/http';
import { ROBLOX_MAX_GAMEPASS_UNITS, robloxGamepassPrice } from '@/lib/roblox';
import { isRegion, type RegionalPrice } from '@/lib/regionalPricing';
import { paymentMethods } from '@/lib/paymentProvider';

export async function GET(req: Request) {
  try {
    await adminAccess(req);
    const { limit, cursor } = pagination(req);
    const rows = await prisma.product.findMany({ where: { type: { not: 'APPS' }, ...(cursor ? { id: { lt: cursor } } : {}) }, take: limit + 1, orderBy: { id: 'desc' }, include: { variants: { orderBy: { id: 'asc' }, include: { regionalPrices: true } } } });
    return NextResponse.json({ success: true, ...pageResult(rows, limit), paymentMethods: { ID: paymentMethods('ID'), MY: paymentMethods('MY'), PH: paymentMethods('PH') } }, { headers: privateHeaders });
  } catch (e) {
    const err = e as { code?: string };
    if (err && typeof err === 'object' && typeof err.code === 'string' && err.code.startsWith('P')) {
      console.error(`[Admin Catalog] Prisma Database Error: ${err.code}`);
      return NextResponse.json({ success: false, errorCode: 'DATABASE_ERROR' }, { status: 500, headers: privateHeaders });
    }
    return apiError(e);
  }
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
      }, { maxWait: 5000, timeout: 15000 });
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
    const dynamicQuantity = method === 'GAMEPASS' || method === 'GIFT_USERNAME';
    const maxUnits = dynamicQuantity && body.maxUnits != null ? body.maxUnits : null;
    const unitStep = dynamicQuantity && maxUnits !== null ? body.unitStep : 1;
    if (maxUnits !== null && (!positiveInt(maxUnits) || !positiveInt(unitStep) || maxUnits < body.units || maxUnits > ROBLOX_MAX_GAMEPASS_UNITS || (method === 'GAMEPASS' && (body.units % 5 !== 0 || unitStep % 5 !== 0)) || (maxUnits - body.units) % unitStep !== 0)) throw new InputError();
    if (dynamicQuantity) {
      try { quoteRobloxQuantity({ units: body.units, price: body.price, maxUnits: maxUnits as number | null, unitStep: unitStep as number }, (maxUnits as number | null) ?? body.units); } catch { throw new InputError(); }
    }
    const regionalPrices: RegionalPrice[] = [];
    if (body.regionalPrices !== undefined) {
      if (product.type !== 'ROBLOX' || !Array.isArray(body.regionalPrices) || body.regionalPrices.length > 3) throw new InputError();
      for (const row of body.regionalPrices) {
        if (!row || typeof row !== 'object' || !isRegion(row.region) || typeof row.active !== 'boolean' ||
            !Number.isSafeInteger(row.amount) || row.amount < 0 || row.amount > 2147483647 || (row.active && row.amount < 1) ||
            regionalPrices.some(p => p.region === row.region) || Object.keys(row).some(k => !['region', 'amount', 'active'].includes(k))) throw new InputError();
        if (row.region === 'ID' && row.amount !== body.price) throw new InputError();
        if (row.active) {
          try { quoteRobloxQuantity({ units: body.units, price: row.amount, maxUnits: maxUnits as number | null, unitStep: unitStep as number }, (maxUnits as number | null) ?? body.units); } catch { throw new InputError(); }
        }
        regionalPrices.push({ region: row.region, amount: row.amount, active: row.active });
      }
    }
    const data = { maxUnits: maxUnits as number | null, unitStep: unitStep as number, productId: product.id, name: textField(body.name, 100)!, price: body.price, units: body.units,
      active: body.active, method, gamepassPrice: method === 'GAMEPASS' ? robloxGamepassPrice(body.units as number) : null,
      providerSku, requiresZone: body.requiresZone === true,
      capacityCheckedAt: method === 'GIFT_USERNAME' && body.capacityConfirmed === true ? new Date() : null };
    if (body.id !== undefined && !positiveInt(body.id)) throw new InputError();
    const result = await prisma.$transaction(async tx => {
      // Serialize configuration changes with checkout's product lock.
      await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${product.id} FOR UPDATE`;
      let saved;
      if (body.id) {
        const existing = await tx.productVariant.findUnique({ where: { id: body.id as number } });
        if (!existing || existing.productId !== product.id) throw new InputError();
        saved = await tx.productVariant.update({ where: { id: existing.id }, data });
      } else {
        saved = await tx.productVariant.create({ data });
      }
      for (const row of regionalPrices) await tx.regionalPrice.upsert({
        where: { variantId_region: { variantId: saved.id, region: row.region } },
        create: { variantId: saved.id, ...row }, update: { amount: row.amount, active: row.active },
      });
      await tx.regionalPrice.updateMany({ where: { variantId: saved.id, region: 'ID' }, data: { amount: saved.price } });
      return saved;
    }, { maxWait: 10000, timeout: 20000 });
    return NextResponse.json({ success: true, data: result }, { headers: privateHeaders });
  } catch (e) {
    const err = e as { code?: string };
    if (err && typeof err === 'object' && typeof err.code === 'string' && err.code.startsWith('P')) {
      console.error(`[Admin Catalog] Prisma Database Error: ${err.code}`);
      return NextResponse.json({ success: false, errorCode: 'DATABASE_ERROR' }, { status: 500, headers: privateHeaders });
    }
    return apiError(e);
  }
}
