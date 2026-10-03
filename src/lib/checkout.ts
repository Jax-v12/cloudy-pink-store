import crypto from 'node:crypto';
import { quoteGamepass } from './gamepassPricing';
import { InputError } from './http';

import { prisma } from './prisma';
import { encryptData } from './crypto';
import { CommerceError, checkoutEnabled, checkoutInput, parseDetails, requestDigest } from './commerce';
import { verifyRobloxDetails, type RobloxVerification } from './robloxVerification';

function quoteVariant(type: string, variant: { method: string | null; units: number; price: number; maxUnits: number | null; unitStep: number } | null, quantity?: number) {
  if (type === 'ROBLOX' && variant?.method === 'GAMEPASS') {
    try { return quoteGamepass(variant, quantity); } catch { throw new InputError(); }
  }
  if (quantity !== undefined) throw new InputError();
  return { units: variant?.units ?? 1, totalAmount: variant?.price };
}

export async function createCheckout(body: Record<string, unknown>, key: string) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) throw new CommerceError('INVALID_INPUT', 400);
  const input = checkoutInput(body);
  const hash = requestDigest(input);
  const replay = async () => {
    const order = await prisma.order.findUnique({ where: { checkoutKey: key } });
    if (order && order.requestHash !== hash) throw new CommerceError('IDEMPOTENCY_CONFLICT');
    return order;
  };
  const existing = await replay();
  if (existing) return { order: existing, created: false };
  // Verify the Roblox recipient before taking locks; upstream calls can take seconds.
  let verified: RobloxVerification | null = null;
  if (input.variantId !== undefined && checkoutEnabled('ROBLOX')) {
    const preview = await prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId, active: true, product: { type: 'ROBLOX', active: true } },
    });
    if (preview) {
      const quote = quoteVariant('ROBLOX', preview, input.quantity);
      verified = await verifyRobloxDetails(parseDetails('ROBLOX', { ...preview, units: quote.units }, input.details).roblox!);
    }
  }
  try {
    return await prisma.$transaction(async tx => {
      // Serialize stock selection and same-product checkout replay before any snapshot read.
      await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${input.productId} FOR UPDATE`;
      const prior = await tx.order.findUnique({ where: { checkoutKey: key } });
      if (prior) {
        if (prior.requestHash !== hash) throw new CommerceError('IDEMPOTENCY_CONFLICT');
        return { order: prior, created: false };
      }
      const product = await tx.product.findUnique({ where: { id: input.productId }, include: { variants: true } });
      if (!product?.active || !checkoutEnabled(product.type)) throw new CommerceError('PRODUCT_UNAVAILABLE');
      const variant = product.variants.find(v => v.id === input.variantId && v.active) ?? null;
      if ((product.type !== 'APPS' && !variant) || (product.type === 'APPS' && input.variantId !== undefined)) throw new CommerceError('INVALID_INPUT', 400);
      if (variant?.method === 'GIFT_USERNAME' && (!variant.capacityCheckedAt || Date.now() - variant.capacityCheckedAt.getTime() > 86_400_000)) throw new CommerceError('CAPACITY_REVIEW_REQUIRED');
      const quote = quoteVariant(product.type, variant, input.quantity);
      const details = parseDetails(product.type, variant ? { ...variant, units: quote.units } : null, input.details);
      // The package may have changed between verification and locking; never persist stale checks.
      if (details.roblox && (!verified || verified.method !== details.roblox.method || verified.gamepassPrice !== details.roblox.gamepassPrice)) {
        throw new CommerceError('PRODUCT_UNAVAILABLE');
      }
      let stockId: number | null = null;
      if (product.type === 'APPS') {
        const stock = await tx.accountStock.findFirst({ where: { productId: product.id, status: 'READY', order: null }, orderBy: { id: 'asc' } });
        if (!stock) throw new CommerceError('STOCK_EMPTY');
        const locked = await tx.accountStock.updateMany({ where: { id: stock.id, status: 'READY', order: null }, data: { status: 'LOCKED' } });
        if (locked.count !== 1) throw new CommerceError('RACE_CONDITION');
        stockId = stock.id;
      }
      const order = await tx.order.create({ data: {
        invoice: `INV-${crypto.randomUUID()}`, productId: product.id, type: product.type,
        productName: product.name, variantName: variant?.name, units: quote.units,
        totalAmount: quote.totalAmount ?? product.price, currency: 'IDR', customerEmail: input.customerEmail,
        accountStockId: stockId, checkoutKey: key, requestHash: hash,
        expiresAt: new Date(Date.now() + 86_400_000),
        ...(details.game ? { gameDetail: { create: details.game } } : {}),
        ...(details.roblox && verified ? { robloxDetail: { create: {
          ...details.roblox, username: verified.username, robloxUserId: verified.robloxUserId, displayName: verified.displayName,
          gamepassId: verified.gamepassId, gamepassVerifiedAt: verified.gamepassVerifiedAt,
        } } } : {}),
        // AES-256-GCM before insertion; only the assigned admin can decrypt after re-authentication.
        ...(details.secret ? { secret: { create: { ciphertext: encryptData(JSON.stringify(details.secret)), expiresAt: new Date(Date.now() + 7 * 86_400_000) } } } : {}),
      } });
      return { order, created: true };
    });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const order = await replay();
      if (order) return { order, created: false };
    }
    throw error;
  }
}
