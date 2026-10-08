import crypto from 'node:crypto';
import { isRegion } from './regionalPricing';
import { ProductType, ProductVariant } from '@prisma/client';
import { InputError, positiveInt, textField } from './http';
import {
  ROBLOX_MAX_GAMEPASS_UNITS,
  ROBLOX_USERNAME_PATTERN, robloxGamepassPrice,
} from './roblox';

export class CommerceError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}

export function checkoutEnabled(type: ProductType) {
  if (type === 'APPS') return true;
  if (type === 'ROBLOX') return process.env.ROBLOX_CHECKOUT_ENABLED === 'true';
  // No live provider has been integrated. A configuration flag cannot bypass this gate.
  return process.env.NODE_ENV !== 'production' && process.env.GAME_PROVIDER === 'simulator';
}

export function checkoutInput(body: Record<string, unknown>) {
  if (!positiveInt(body.productId)) throw new InputError();
  const email = textField(body.customerEmail, 150)!.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new InputError();
  if (body.variantId !== undefined && !positiveInt(body.variantId)) throw new InputError();
  if (body.quantity !== undefined && !positiveInt(body.quantity)) throw new InputError();
  const details = body.details ?? {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new InputError();
  if (['password', 'robloxPassword', 'backupCodes', 'note', 'otp', 'sessionCookie'].some(key => key in details)) throw new InputError();
  if (body.pricingRegion !== undefined && !isRegion(body.pricingRegion)) throw new InputError();
  if (body.paymentMethod !== undefined && (typeof body.paymentMethod !== 'string' || !/^[A-Z0-9_]{1,40}$/.test(body.paymentMethod))) throw new InputError();
  if (body.quoteToken !== undefined && (typeof body.quoteToken !== 'string' || !/^[a-f0-9]{64}$/.test(body.quoteToken))) throw new InputError();
  if (Object.keys(body).some(k => !['productId', 'customerEmail', 'variantId', 'details', 'quantity', 'pricingRegion', 'paymentMethod', 'quoteToken'].includes(k))) throw new InputError();
  return { productId: body.productId, customerEmail: email, variantId: body.variantId as number | undefined, quantity: body.quantity as number | undefined,
    // Preserve the digest of legacy requests which omitted these fields.
    ...(body.pricingRegion !== undefined ? { pricingRegion: body.pricingRegion as 'ID' | 'MY' | 'PH' } : {}),
    ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod as string } : {}),
    ...(body.quoteToken !== undefined ? { quoteToken: body.quoteToken as string } : {}),
    details: details as Record<string, unknown> };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}

export function requestDigest(value: unknown) {
  const key = process.env.CHECKOUT_HASH_KEY || process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('CHECKOUT_HASH_KEY_REQUIRED');
  // Keyed hash prevents offline guessing of private request details in checkout snapshots.
  return crypto.createHmac('sha256', key).update(canonical(value)).digest('hex');
}

export function parseDetails(type: ProductType, variant: ProductVariant | null, details: Record<string, unknown>) {
  const allowed = type === 'GAME' ? ['userId', 'zoneId'] : type === 'ROBLOX'
    ? variant?.method === 'GAMEPASS' ? ['username', 'gamepassUrl'] : ['username'] : [];
  if (Object.keys(details).some(k => !allowed.includes(k))) throw new InputError();
  if (type === 'APPS') return {};
  if (!variant) throw new InputError();
  if (type === 'GAME') {
    const userId = textField(details.userId, 64)!;
    const zoneId = textField(details.zoneId, 32, !variant.requiresZone);
    if (!/^[A-Za-z0-9_-]+$/.test(userId) || (zoneId && !/^[A-Za-z0-9_-]+$/.test(zoneId))) throw new InputError();
    if (!variant.providerSku) throw new CommerceError('PRODUCT_UNAVAILABLE');
    return { game: { userId, zoneId, provider: 'simulator', providerSku: variant.providerSku } };
  }
  if (!variant.method) throw new InputError();
  const username = textField(details.username, 20)!;
  if (!ROBLOX_USERNAME_PATTERN.test(username)) throw new InputError();
  let gamepassUrl: string | null = null;
  let gamepassPrice: number | null = null;
  if (variant.method === 'GAMEPASS') {
    const raw = textField(details.gamepassUrl, 500)!;
    let url: URL;
    try { url = new URL(raw); } catch { throw new InputError(); }
    if (url.protocol !== 'https:' || !['www.roblox.com', 'roblox.com'].includes(url.hostname) || url.port ||
        url.username || url.password || !/^\/game-pass\/\d+(?:\/[^/?#]*)?\/?$/.test(url.pathname) || url.search || url.hash) throw new InputError();
    gamepassUrl = url.toString();
    // The price is never trusted from the client or typed by admins: Roblox keeps 30%,
    // so the buyer must list the pass at ceil(units / 0.7) to net exactly `units`.
    if (!Number.isInteger(variant.units) || variant.units < 1 || variant.units > ROBLOX_MAX_GAMEPASS_UNITS) throw new CommerceError('PRODUCT_UNAVAILABLE');
    gamepassPrice = robloxGamepassPrice(variant.units);
  }
  return { roblox: { method: variant.method, username, gamepassUrl, gamepassPrice } };
}
