import crypto from 'node:crypto';
import { quoteRobloxQuantity } from './robloxPricing';
import { InputError } from './http';

import { prisma } from './prisma';
import { CommerceError, checkoutEnabled, checkoutInput, parseDetails, requestDigest } from './commerce';
import { verifyRobloxDetails, type RobloxVerification } from './robloxVerification';
import { checkoutPricing, checkoutQuoteToken } from './checkoutPricing';
import type { Region } from './regionalPricing';
import { encryptData } from './crypto';
import { LOGIN_ACCESS_TTL_MS } from './loginCredentials';
import { attemptTransaction, prepareAttemptCommit, type AttemptCommit } from './checkoutAttempt';

function quoteVariant(type: string, variant: { method: string | null; units: number; price: number; maxUnits: number | null; unitStep: number } | null, quantity?: number) {
  if (type === 'ROBLOX' && (variant?.method === 'GAMEPASS' || variant?.method === 'GIFT_USERNAME')) {
    try { return quoteRobloxQuantity(variant, quantity); } catch { throw new InputError(); }
  }
  if (quantity !== undefined) throw new InputError();
  return { units: variant?.units ?? 1, totalAmount: variant?.price };
}

export async function createCheckout(body: Record<string, unknown>, key: string, resolvedRegion: Region | null = null, attempt?: AttemptCommit, requireLoginAttempt = false) {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(key)) throw new CommerceError('INVALID_INPUT', 400);
  const input = checkoutInput(body);
  const hash = requestDigest(input);
  const replay = async () => {
    const order = await prisma.order.findUnique({ where: { checkoutKey: key }, include: { checkoutAttempt: { select: { id: true } } } });
    if (order?.checkoutAttempt) throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
    if (order && order.requestHash !== hash) throw new CommerceError('IDEMPOTENCY_CONFLICT');
    return order;
  };
  // Attempt replay is authenticated and serialized by its caller, before draft/quote drift.
  const existing = attempt ? null : await replay();
  if (existing) return { order: existing, created: false };
  // Old payloads may recover an existing invoice but cannot choose a region for new orders.
  if (input.pricingRegion !== undefined) throw new InputError();
  // Verify the Roblox recipient before taking locks; upstream calls can take seconds.
  let verified: RobloxVerification | null = null;
  if (input.variantId !== undefined && checkoutEnabled('ROBLOX')) {
    const preview = await prisma.productVariant.findFirst({
      where: { id: input.variantId, productId: input.productId, active: true, product: { type: 'ROBLOX', active: true } },
    });
    if (preview) {
      if (requireLoginAttempt && preview.method === 'LOGIN') throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
      const quote = quoteVariant('ROBLOX', { ...preview, price: 1 }, input.quantity);
      verified = await verifyRobloxDetails(parseDetails('ROBLOX', { ...preview, units: quote.units }, input.details).roblox!);
    }
  }
  try {
    return await prisma.$transaction(async tx => {
      const committing = attempt ? await prepareAttemptCommit(tx, attempt, key, hash, input.productId, input.variantId) : null;
      // Serialize stock selection and same-product checkout replay before any snapshot read.
      await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${input.productId} FOR UPDATE`;
      const prior = await tx.order.findUnique({ where: { checkoutKey: key }, include: { checkoutAttempt: { select: { id: true } } } });
      if (prior) {
        if (attempt) throw new CommerceError('ATTEMPT_INCONSISTENT', 503);
        if (!attempt && prior.checkoutAttempt) throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
        if (prior.requestHash !== hash) throw new CommerceError('IDEMPOTENCY_CONFLICT');
        return { order: prior, created: false };
      }
      const product = await tx.product.findUnique({ where: { id: input.productId }, include: { variants: { include: { regionalPrices: true } } } });
      if (!product?.active || !checkoutEnabled(product.type)) throw new CommerceError('PRODUCT_UNAVAILABLE');
      const variant = product.variants.find(v => v.id === input.variantId && v.active) ?? null;
      if (requireLoginAttempt && product.type === 'ROBLOX' && variant?.method === 'LOGIN') throw new CommerceError('CHECKOUT_SESSION_REQUIRED', 401);
      if (attempt && (product.type !== 'ROBLOX' || variant?.method !== 'LOGIN')) throw new CommerceError('PRODUCT_UNAVAILABLE');
      if ((product.type !== 'APPS' && !variant) || (product.type === 'APPS' && input.variantId !== undefined)) throw new CommerceError('INVALID_INPUT', 400);
      if (variant?.method === 'GIFT_USERNAME' && (!variant.capacityCheckedAt || Date.now() - variant.capacityCheckedAt.getTime() > 86_400_000)) throw new CommerceError('CAPACITY_REVIEW_REQUIRED');
      if (product.type === 'ROBLOX' && !resolvedRegion) throw new CommerceError('REGION_UNVERIFIED');
      const quote = checkoutPricing(product.type, product.price, variant, product.type === 'ROBLOX' ? resolvedRegion! : 'ID', input.paymentMethod ?? 'QRIS', input.quantity);
      // Check after idempotency replay, under the same lock as authoritative pricing.
      // Every new Roblox order requires a confirmed server quote, including legacy clients.
      if (product.type === 'ROBLOX' && variant) {
        const token = checkoutQuoteToken(product.id, variant.id, quote);
        if (!input.quoteToken || !crypto.timingSafeEqual(Buffer.from(input.quoteToken, 'hex'), Buffer.from(token, 'hex'))) {
          throw new CommerceError('PRICE_CHANGED');
        }
      }
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
      const invoice = `INV-${crypto.randomUUID()}`;
      const order = await tx.order.create({ data: {
        invoice, productId: product.id, type: product.type,
        productName: product.name, variantName: variant?.name, units: quote.units,
        totalAmount: quote.totalAmount, currency: quote.currency, pricingRegion: quote.pricingRegion,
        productSubtotal: quote.productSubtotal, paymentFee: quote.paymentFee, discount: quote.discount,
        paymentProvider: quote.paymentProvider, paymentMethod: quote.paymentMethod, customerEmail: input.customerEmail,
        accountStockId: stockId, checkoutKey: key, requestHash: hash,
        expiresAt: new Date(Date.now() + 86_400_000),
        ...(details.game ? { gameDetail: { create: details.game } } : {}),
        ...(details.loginCredentials && verified ? { secret: { create: {
          ciphertext: encryptData(JSON.stringify({ version: 1, invoice, username: verified.username, ...details.loginCredentials })),
          expiresAt: new Date(Date.now() + LOGIN_ACCESS_TTL_MS),
        } } } : {}),
        ...(details.roblox && verified ? { robloxDetail: { create: {
          ...details.roblox, username: verified.username, robloxUserId: verified.robloxUserId, displayName: verified.displayName,
          ...(details.loginContact ? { whatsappE164: encryptData(details.loginContact.whatsappE164) } : {}),
          gamepassId: verified.gamepassId, gamepassVerifiedAt: verified.gamepassVerifiedAt,
        } } } : {}),
      } });
      if (committing) await tx.checkoutAttempt.update({ where: { id: committing.id }, data: {
        state: 'COMMITTED', orderId: order.id, leaseUntil: null,
        quoteSnapshot: { units: quote.units, totalAmount: quote.totalAmount, currency: quote.currency,
          pricingRegion: quote.pricingRegion, productSubtotal: quote.productSubtotal, paymentFee: quote.paymentFee, discount: quote.discount,
          paymentRecovery: { version: 1 } },
      } });
      return { order, created: true };
    }, attempt ? attemptTransaction : undefined);
  } catch (error) {
    if (!attempt && error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      const order = await replay();
      if (order) return { order, created: false };
    }
    throw error;
  }
}

// Legacy HTTP transport may replay historical Login orders, never create new ones.
// The ungated domain entry point remains available to existing isolated DB fixtures.
export function createLegacyCheckout(body: Record<string, unknown>, key: string, region: Region | null) {
  return createCheckout(body, key, region, undefined, true);
}
