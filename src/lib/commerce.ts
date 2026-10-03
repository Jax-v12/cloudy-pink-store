import crypto from 'node:crypto';
import { ProductType, ProductVariant } from '@prisma/client';
import { InputError, positiveInt, textField } from './http';
import {
  ROBLOX_BACKUP_CODE_PATTERN, ROBLOX_MAX_BACKUP_CODES, ROBLOX_MAX_GAMEPASS_UNITS, ROBLOX_MAX_LOGIN_NOTE,
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
  const details = body.details ?? {};
  if (!details || typeof details !== 'object' || Array.isArray(details)) throw new InputError();
  if (Object.keys(body).some(k => !['productId', 'customerEmail', 'variantId', 'details'].includes(k))) throw new InputError();
  return { productId: body.productId, customerEmail: email, variantId: body.variantId as number | undefined,
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
  // Keyed hash prevents offline guessing of low-entropy credentials in request snapshots.
  return crypto.createHmac('sha256', key).update(canonical(value)).digest('hex');
}

export function parseDetails(type: ProductType, variant: ProductVariant | null, details: Record<string, unknown>) {
  const allowed = type === 'GAME' ? ['userId', 'zoneId'] : type === 'ROBLOX'
    ? variant?.method === 'LOGIN' ? ['username', 'password', 'backupCodes', 'note']
      : variant?.method === 'GAMEPASS' ? ['username', 'gamepassUrl'] : ['username'] : [];
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
  let secret: { password: string; backupCodes: string[]; note: string | null } | undefined;
  if (variant.method === 'LOGIN') {
    const { password } = details;
    const backupCodes = details.backupCodes ?? [];
    if (typeof password !== 'string' || !password || password.length > 1024 || !Array.isArray(backupCodes) ||
        backupCodes.length > ROBLOX_MAX_BACKUP_CODES || backupCodes.some(c => typeof c !== 'string' || !ROBLOX_BACKUP_CODE_PATTERN.test(c)) ||
        new Set(backupCodes).size !== backupCodes.length) throw new InputError();
    const note = textField(details.note, ROBLOX_MAX_LOGIN_NOTE, true);
    secret = { password, backupCodes: backupCodes as string[], note };
  }
  return { roblox: { method: variant.method, username, gamepassUrl, gamepassPrice }, secret };
}
