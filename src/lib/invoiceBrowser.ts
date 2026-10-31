'use client';

// Only failed writes remain here. Successful saves use the existing legacy key.
const pendingAccess = new Map<string, string>();
export function invoiceId(value: unknown): value is string { return typeof value === 'string' && /^INV-[A-Za-z0-9_-]{1,187}$/.test(value); }
// Legacy invoice access follows invoiceAccessWhere's locator contract; Login DTOs stay stricter.
function legacyInvoice(value: unknown): value is string { return typeof value === 'string' && value.length > 0 && value.length <= 191; }

export function rememberInvoiceAccess(invoice: string, token: string): boolean {
  if (!legacyInvoice(invoice) || typeof token !== 'string' || !token || token.length > 128 || /[\u0000-\u001f\u007f]/.test(token)) throw new Error('CHECKOUT_UNKNOWN');
  pendingAccess.set(invoice, token);
  try {
    window.localStorage.setItem(`token_${invoice}`, token);
    pendingAccess.delete(invoice);
    return true;
  } catch { return false; }
}

export function readInvoiceAccess(invoice: string): string | null {
  if (!legacyInvoice(invoice)) return null;
  const pending = pendingAccess.get(invoice);
  if (pending) return pending;
  try { return window.localStorage.getItem(`token_${invoice}`); }
  catch { return null; }
}

export function hasPendingInvoiceAccess(invoice: string): boolean { return pendingAccess.has(invoice); }

export function persistInvoiceAccess(invoice: string): boolean {
  const token = pendingAccess.get(invoice);
  return token ? rememberInvoiceAccess(invoice, token) : true;
}

/** Check before a new order; a race after this check is retained in memory. */
export function canPersistInvoiceAccess(): boolean {
  try {
    for (const invoice of pendingAccess.keys()) if (!persistInvoiceAccess(invoice)) return false;
    const storage = window.localStorage;
    storage.setItem('cloudy_invoice_access_probe', '1'.repeat(128));
    storage.removeItem('cloudy_invoice_access_probe');
    return true;
  } catch { return false; }
}
