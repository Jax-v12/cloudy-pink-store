'use client';
import { invoiceId } from './invoiceBrowser';
export { invoiceId } from './invoiceBrowser';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export type LoginAttempt = { flowId: string; productId: number; variantId: number; version: number; expiresAt: string;
  outcome: 'NOT_COMMITTED' | 'UNKNOWN' | 'COMMITTED' | 'EXPIRED' | 'CANCELLED'; selectionLocked: boolean; invoice?: string };

// The only durable values are public UUID locators. No customer/quote/request data.
export function checkoutLocator(): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let database: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    const finish = (locator?: string) => {
      if (settled) return; settled = true; clearTimeout(timer); database?.close();
      if (locator) resolve(locator); else reject(new Error('CHECKOUT_STORAGE_UNAVAILABLE'));
    };
    const timer = setTimeout(() => { try { transaction?.abort(); } catch { /* Already completed; never issue HTTP from this callback. */ } finish(); }, 3000);
    try {
      if (!globalThis.indexedDB) { finish(); return; }
      const request = indexedDB.open('cloudy-checkout', 1);
      request.onupgradeneeded = () => {
        try { request.result.createObjectStore('coordination'); }
        catch { finish(); }
      };
      request.onerror = () => finish(); request.onblocked = () => finish();
      request.onsuccess = () => {
        database = request.result;
        if (settled) { database.close(); return; }
        try {
          transaction = database.transaction('coordination', 'readwrite');
          const store = transaction.objectStore('coordination');
          const read = store.get('bootstrap'); let locator: string | undefined;
          read.onsuccess = () => {
            try {
              if (read.result === undefined) { locator = crypto.randomUUID(); store.add(locator, 'bootstrap'); }
              else if (typeof read.result === 'string' && uuid.test(read.result)) locator = read.result;
              else transaction?.abort();
            } catch { finish(); }
          };
          transaction.oncomplete = () => finish(locator);
          transaction.onerror = () => finish(); transaction.onabort = () => finish();
        } catch { finish(); }
      };
    } catch { finish(); }
  });
}

export async function loginRequest(path: string, body: unknown): Promise<Record<string, unknown>> {
  try {
    const response = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const json = await response.json();
    if (!response.ok || json.success !== true) throw new Error(typeof json.errorCode === 'string' && /^[A-Z_]{1,64}$/.test(json.errorCode) ? json.errorCode : 'CHECKOUT_UNKNOWN');
    if (!json.data || typeof json.data !== 'object' || Array.isArray(json.data)) throw new Error('CHECKOUT_UNKNOWN');
    return json.data;
  } catch (error) {
    if (error instanceof Error && /^[A-Z_]{1,64}$/.test(error.message)) throw error;
    throw new Error('CHECKOUT_UNKNOWN');
  }
}

let bootstrap: Promise<void> | null = null;
export function ensureCheckoutSession() {
  // Share only an in-flight public handshake, never cache authorization. Do not
  // abort the sole issuer on React StrictMode's simulated unmount.
  if (!bootstrap) bootstrap = (async () => {
    const locator = await checkoutLocator();
    for (const delay of [0, 250, 750, 1500, 3000]) {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      try {
        const result = await loginRequest('/api/checkout/session', { locator });
        if (result.outcome === 'READY') return;
        if (result.outcome !== 'COOKIE_ISSUED') throw new Error('CHECKOUT_UNKNOWN');
      } catch (error) {
        if (!(error instanceof Error) || !['CHECKOUT_BOOTSTRAP_PENDING', 'CHECKOUT_UNKNOWN', 'RATE_LIMIT_EXCEEDED'].includes(error.message)) throw error;
      }
    }
    throw new Error('CHECKOUT_BOOTSTRAP_PENDING');
  })().finally(() => { bootstrap = null; });
  return bootstrap;
}

export function storedFlow(productId: number, replacement?: string) {
  try {
    const key = `cloudy-login-flow:${productId}`;
    if (replacement !== undefined) {
      if (!uuid.test(replacement)) throw new Error();
      sessionStorage.setItem(key, replacement);
    }
    const value = sessionStorage.getItem(key);
    if (value !== null && !uuid.test(value)) throw new Error();
    return value;
  } catch { throw new Error('CHECKOUT_STORAGE_UNAVAILABLE'); }
}

export function loginAttempt(data: Record<string, unknown>, productId: number): LoginAttempt {
  if (typeof data.flowId !== 'string' || !uuid.test(data.flowId) || data.productId !== productId ||
      typeof data.variantId !== 'number' || !Number.isSafeInteger(data.variantId) || data.variantId < 1 ||
      typeof data.version !== 'number' || !Number.isSafeInteger(data.version) || data.version < 0 ||
      typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt)) ||
      !['NOT_COMMITTED', 'UNKNOWN', 'COMMITTED', 'EXPIRED', 'CANCELLED'].includes(String(data.outcome)) ||
      typeof data.selectionLocked !== 'boolean' || (data.outcome === 'COMMITTED' && !invoiceId(data.invoice))) throw new Error('CHECKOUT_UNKNOWN');
  return { flowId: data.flowId, productId, variantId: data.variantId, version: data.version, expiresAt: data.expiresAt,
    outcome: data.outcome as LoginAttempt['outcome'], selectionLocked: data.selectionLocked, ...(invoiceId(data.invoice) ? { invoice: data.invoice } : {}) };
}
