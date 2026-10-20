export interface RecentOrderItem {
  invoice: string;
  visitedAt: string;
}

export const RECENT_ORDERS_STORAGE_KEY = 'cloudy_recent_orders';
export const RECENT_ORDERS_MAX_ITEMS = 5;
export const RECENT_ORDERS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

function isValidInvoice(value: unknown): value is string {
  return typeof value === 'string' && /^INV-[A-Za-z0-9_-]{1,60}$/i.test(value.trim());
}

function normalizeVisitedAt(value: unknown, now: number): string | null {
  if (typeof value !== 'string' || value.length > 40) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  if (now - parsed > RECENT_ORDERS_RETENTION_MS || parsed > now + 86_400_000) return null;
  return new Date(parsed).toISOString();
}

function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

export function getRecentOrders(now = Date.now()): RecentOrderItem[] {
  try {
    const storage = getStorage();
    if (!storage) return [];
    const raw = storage.getItem(RECENT_ORDERS_STORAGE_KEY);
    if (!raw || typeof raw !== 'string' || raw.length > 8192) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const seen = new Set<string>();
    const items: RecentOrderItem[] = [];

    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const record = entry as Record<string, unknown>;
      if (!isValidInvoice(record.invoice)) continue;
      const invoice = record.invoice.trim();
      const key = invoice.toUpperCase();
      if (seen.has(key)) continue;

      const visitedAt = normalizeVisitedAt(record.visitedAt, now);
      if (!visitedAt) continue;

      seen.add(key);
      // Only non-sensitive invoice ID and visit timestamp are kept.
      items.push({ invoice, visitedAt });
      if (items.length >= RECENT_ORDERS_MAX_ITEMS) break;
    }

    return items;
  } catch {
    return [];
  }
}

export function saveRecentOrder(
  input: { invoice: string; visitedAt?: string },
  now = Date.now(),
): void {
  if (!input || !isValidInvoice(input.invoice)) return;
  const invoice = input.invoice.trim();
  const visitedAt = normalizeVisitedAt(input.visitedAt ?? new Date(now).toISOString(), now);
  if (!visitedAt) return;

  try {
    const storage = getStorage();
    if (!storage) return;
    const current = getRecentOrders(now);
    const key = invoice.toUpperCase();
    const filtered = current.filter(item => item.invoice.toUpperCase() !== key);
    filtered.unshift({ invoice, visitedAt });
    storage.setItem(
      RECENT_ORDERS_STORAGE_KEY,
      JSON.stringify(filtered.slice(0, RECENT_ORDERS_MAX_ITEMS)),
    );
  } catch {
    // Graceful fallback if localStorage is disabled or quota is reached
  }
}

export function clearRecentOrders(): void {
  try {
    const storage = getStorage();
    if (!storage) return;
    storage.removeItem(RECENT_ORDERS_STORAGE_KEY);
  } catch {
    // Graceful fallback if localStorage is unavailable
  }
}
