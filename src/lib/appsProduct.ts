import { InputError, textField } from './http';

export type AppsConfig = {
  version: 1; appGroup: string; accountType: string; durationDays: number;
  devices: string; regionRules: string; usageRules: string; included: string; instructions: string;
  warrantyDays: number; warrantyTerms: string; fulfillmentMode: 'READY_ACCOUNT' | 'ACTIVATION';
  activationMethod: 'INVITATION' | 'LINK' | 'VOUCHER' | null;
};
export const APPS_DELIVERY_TTL_MS = 72 * 3600_000;
export function appsDeliveryVisible(deliveredAt: Date | string | null | undefined, now = Date.now()) {
  const time = deliveredAt instanceof Date ? deliveredAt.getTime() : typeof deliveredAt === 'string' ? Date.parse(deliveredAt) : NaN;
  return Number.isFinite(time) && now >= time && now - time < APPS_DELIVERY_TTL_MS;
}

export function parseAppsConfig(value: unknown): AppsConfig | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new InputError();
  const v = value as Record<string, unknown>;
  const fields = ['version', 'appGroup', 'accountType', 'durationDays', 'devices', 'regionRules', 'usageRules', 'included', 'instructions', 'warrantyDays', 'warrantyTerms', 'fulfillmentMode', 'activationMethod'];
  if (Object.keys(v).some(k => !fields.includes(k)) || v.version !== 1 ||
      !Number.isInteger(v.durationDays) || Number(v.durationDays) < 1 || Number(v.durationDays) > 3650 ||
      !Number.isInteger(v.warrantyDays) || Number(v.warrantyDays) < 0 || Number(v.warrantyDays) > 3650 ||
      !['READY_ACCOUNT', 'ACTIVATION'].includes(String(v.fulfillmentMode)) ||
      (v.fulfillmentMode === 'READY_ACCOUNT' ? v.activationMethod !== null : !['INVITATION', 'LINK', 'VOUCHER'].includes(String(v.activationMethod)))) throw new InputError();
  return { version: 1, appGroup: textField(v.appGroup, 50)!, accountType: textField(v.accountType, 100)!,
    durationDays: Number(v.durationDays), devices: textField(v.devices, 300)!, regionRules: textField(v.regionRules, 300)!,
    usageRules: textField(v.usageRules, 2000)!, included: textField(v.included, 1000)!, instructions: textField(v.instructions, 2000)!,
    warrantyDays: Number(v.warrantyDays), warrantyTerms: textField(v.warrantyTerms, 2000)!,
    fulfillmentMode: v.fulfillmentMode as AppsConfig['fulfillmentMode'], activationMethod: v.activationMethod as AppsConfig['activationMethod'] };
}

export function appsWarranty(snapshot: AppsConfig | null, paidAt: Date | null, activeFrom: Date | null, now = new Date()) {
  const days = snapshot?.warrantyDays ?? 25;
  const start = snapshot?.fulfillmentMode === 'ACTIVATION' ? activeFrom : paidAt;
  const expiresAt = start && Number.isFinite(start.getTime()) ? new Date(start.getTime() + days * 86400_000) : null;
  return { days, expiresAt, active: Boolean(days > 0 && start && now >= start && expiresAt && now < expiresAt), legacy: !snapshot };
}

export type AppsProduct = { id: number; name: string; slug: string; price: number | null; category: string; stockAvailable: number;
  checkoutEnabled: boolean; appsConfig: AppsConfig | null; appsPolicyToken?: string | null };

export async function parseCatalogResponse(response: Response): Promise<{ data: AppsProduct[]; nextCursor: number | null; region: 'ID' | null }> {
  if (!response.ok) throw new Error('CATALOG_ERROR');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('success' in body) || body.success !== true || !('data' in body) || !Array.isArray(body.data) ||
      !('pagination' in body) || !body.pagination || typeof body.pagination !== 'object' || !('nextCursor' in body.pagination)) throw new Error('CATALOG_ERROR');
  const cursor = body.pagination.nextCursor;
  if (cursor !== null && (typeof cursor !== 'number' || !Number.isSafeInteger(cursor) || cursor < 1)) throw new Error('CATALOG_ERROR');
  const data = body.data.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('CATALOG_ERROR');
    const p = row as Record<string, unknown>;
    if (!Number.isSafeInteger(p.id) || Number(p.id) < 1 || typeof p.name !== 'string' || typeof p.slug !== 'string' ||
        (p.price !== null && (!Number.isSafeInteger(p.price) || Number(p.price) < 0)) || !Number.isSafeInteger(p.stockAvailable) || Number(p.stockAvailable) < 0 ||
        typeof p.checkoutEnabled !== 'boolean') throw new Error('CATALOG_ERROR');
    return { id: Number(p.id), name: p.name, slug: p.slug, price: p.price === null ? null : Number(p.price), category: typeof p.category === 'string' ? p.category : '',
      stockAvailable: Number(p.stockAvailable), checkoutEnabled: p.checkoutEnabled, appsConfig: parseAppsConfig(p.appsConfig),
      appsPolicyToken: typeof p.appsPolicyToken === 'string' ? p.appsPolicyToken : null };
  });
  const region = 'location' in body && body.location && typeof body.location === 'object' &&
    'region' in body.location && body.location.region === 'ID' ? 'ID' : null;
  return { data, nextCursor: cursor, region };
}

export function catalogFilters(params: URLSearchParams) {
  const search = textField(params.get('q'), 100, true);
  const category = textField(params.get('category'), 50, true);
  return { ...(search ? { name: { contains: search } } : {}), ...(category ? { category } : {}) };
}
