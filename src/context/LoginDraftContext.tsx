'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { LoginAccount } from '@/lib/loginContact';
import { LOGIN_BACKUP_CODE_COUNT } from '@/lib/loginCredentials';
import { ensureCheckoutSession, invoiceId, loginAttempt, loginRequest, storedFlow, type LoginAttempt } from '@/lib/checkoutBrowser';

type Draft = { variantId: number | null; account: LoginAccount; paymentMethod: string };
const emptyDraft = (): Draft => ({ variantId: null, account: { username: '', email: '', whatsapp: '', country: 'ID', password: '', backupCodes: Array.from({ length: LOGIN_BACKUP_CODE_COUNT }, () => '') }, paymentMethod: '' });
type Checkout = { phase: 'CHECKING' | 'READY' | 'UNKNOWN' | 'BLOCKED'; attempt: LoginAttempt | null; error: string; revision: number };
const blocked = (code: string) => ['CHECKOUT_SESSION_REQUIRED', 'CHECKOUT_LOCATOR_CONFLICT', 'CHECKOUT_STORAGE_UNAVAILABLE', 'CSRF_REJECTED', 'CHECKOUT_BOOTSTRAP_PENDING'].includes(code);
const Context = createContext<{ draft: Draft; setDraft: Dispatch<SetStateAction<Draft>>; checkout: Checkout; busy: boolean;
  initialize: (productId: number, retry?: boolean) => Promise<void>;
  openPackage: (productId: number, variantId: number, repeat?: boolean) => Promise<LoginAttempt | null>;
  recover: () => Promise<void>; confirm: (body: Record<string, unknown>) => Promise<string | null> } | null>(null);

/** Contact and account access stay in memory only; hard reload discards them. */
export function LoginDraftProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [checkout, setCheckout] = useState<Checkout>({ phase: 'CHECKING', attempt: null, error: '', revision: 0 });
  const current = useRef(checkout), product = useRef<number | null>(null), flow = useRef<string | null>(null);
  const submitting = useRef(false), alive = useRef(true), generation = useRef(0), polls = useRef(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const publish = useCallback((value: Checkout) => { if (alive.current) { current.current = value; setCheckout(value); } }, []);
  const adopt = useCallback((row: LoginAttempt) => {
    storedFlow(row.productId, row.flowId); flow.current = row.flowId;
    if (alive.current) setDraft(old => ({ ...old, variantId: row.variantId,
      account: ['COMMITTED', 'EXPIRED', 'CANCELLED'].includes(row.outcome) ? { ...old.account, password: '', backupCodes: emptyDraft().account.backupCodes } : old.account }));
    publish({ ...current.current, attempt: row, phase: row.outcome === 'UNKNOWN' ? 'UNKNOWN' : 'READY',
      error: row.outcome === 'COMMITTED' ? '' : row.outcome === 'NOT_COMMITTED' ? (current.current.phase === 'UNKNOWN' ? 'CHECKOUT_READY' : '') : current.current.error,
      revision: current.current.revision + (row.outcome === 'NOT_COMMITTED' ? 1 : 0) });
  }, [publish]);
  const recoverInternal = useCallback(async (automatic = false) => {
    if (submitting.current || !flow.current || !product.current) return;
    if (!automatic) polls.current = 0;
    submitting.current = true; setBusy(true);
    const epoch = generation.current;
    try {
      const data = await loginRequest(`/api/checkout/attempts/${flow.current}/recover`, {});
      if (epoch === generation.current && alive.current) adopt(loginAttempt(data, product.current));
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CHECKOUT_UNKNOWN';
      if (epoch === generation.current) publish({ ...current.current, attempt: code === 'ATTEMPT_NOT_FOUND' ? null : current.current.attempt,
        phase: code === 'ATTEMPT_NOT_FOUND' ? 'READY' : blocked(code) ? 'BLOCKED' : 'UNKNOWN', error: code });
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  }, [adopt, publish]);
  const initialize = useCallback(async (productId: number, retry = false) => {
    if (product.current === productId && !retry) return;
    product.current = productId; flow.current = null; const epoch = ++generation.current; polls.current = 0;
    let sessionReady = false;
    publish({ phase: 'CHECKING', attempt: null, error: '', revision: current.current.revision });
    try {
      await ensureCheckoutSession();
      if (!alive.current || epoch !== generation.current) return;
      sessionReady = true;
      flow.current = storedFlow(productId);
      if (flow.current) {
        try {
          const data = await loginRequest(`/api/checkout/attempts/${flow.current}/recover`, {});
          if (alive.current && epoch === generation.current) adopt(loginAttempt(data, productId));
        }
        catch (error) {
          // A lost *open* response may precede any attempt creation. Preserve its
          // UUID; only an idempotent open under the session lock may resolve it.
          if (!(error instanceof Error) || error.message !== 'ATTEMPT_NOT_FOUND') throw error;
          if (epoch === generation.current) publish({ ...current.current, phase: 'READY', attempt: null });
        }
      } else publish({ ...current.current, phase: 'READY' });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CHECKOUT_UNKNOWN';
      if (epoch === generation.current) publish({ ...current.current, phase: sessionReady && flow.current && !blocked(code) ? 'UNKNOWN' : 'BLOCKED', error: code });
    }
  }, [adopt, publish]);
  const openPackage = useCallback(async (productId: number, variantId: number, repeat = false) => {
    if (submitting.current || current.current.phase !== 'READY' || product.current !== productId) return null;
    const prior = current.current.attempt;
    if (repeat && (!prior || !['COMMITTED', 'EXPIRED', 'CANCELLED'].includes(prior.outcome))) return null;
    submitting.current = true; setBusy(true); polls.current = 0;
    const epoch = generation.current;
    try {
      flow.current = repeat ? crypto.randomUUID() : storedFlow(productId) ?? crypto.randomUUID();
      storedFlow(productId, flow.current);
      const row = loginAttempt(await loginRequest('/api/checkout/attempts', { productId, variantId, flowId: flow.current,
        ...(repeat && prior ? { previousFlowId: prior.flowId } : {}) }), productId);
      if (!alive.current || epoch !== generation.current) return null;
      adopt(row);
      if (repeat && row.outcome === 'NOT_COMMITTED' && alive.current) setDraft({ ...emptyDraft(), variantId: row.variantId });
      return row;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CHECKOUT_UNKNOWN';
      publish({ ...current.current, phase: blocked(code) ? 'BLOCKED' : 'UNKNOWN', error: code }); return null;
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  }, [adopt, publish]);
  const confirm = useCallback(async (body: Record<string, unknown>) => {
    const row = current.current.attempt;
    if (submitting.current || current.current.phase !== 'READY' || row?.outcome !== 'NOT_COMMITTED') return null;
    submitting.current = true; setBusy(true); polls.current = 0;
    const epoch = generation.current;
    publish({ ...current.current, phase: 'UNKNOWN', error: '' });
    try {
      // Only this explicit final click authorizes a changed quote after locked
      // NOT_COMMITTED. Recovery/polling never sends a confirmation or new key.
      const data = await loginRequest(`/api/checkout/attempts/${row.flowId}/confirm`, { version: row.version, checkout: body, reconfirm: true });
      if (data.outcome !== 'COMMITTED' || data.flowId !== row.flowId || !invoiceId(data.invoice)) throw new Error('CHECKOUT_UNKNOWN');
      if (!alive.current || epoch !== generation.current) return null;
      adopt({ ...row, outcome: 'COMMITTED', invoice: data.invoice, selectionLocked: true });
      return data.invoice;
    } catch (error) {
      const code = error instanceof Error ? error.message : 'CHECKOUT_UNKNOWN';
      publish({ ...current.current, phase: blocked(code) ? 'BLOCKED' : 'UNKNOWN', error: code }); return null;
    } finally { submitting.current = false; if (alive.current) setBusy(false); }
  }, [adopt, publish]);
  useEffect(() => {
    const delays = [1000, 2000, 4000, 8000, 16000];
    if (checkout.phase !== 'UNKNOWN' || busy || polls.current >= delays.length) return;
    const timer = setTimeout(() => { void recoverInternal(true); }, delays[polls.current++]);
    return () => clearTimeout(timer);
  }, [checkout, busy, recoverInternal]);
  // Contacts remain available for navigation; secrets are cleared on terminal outcomes.
  return <Context.Provider value={{ draft, setDraft, checkout, busy, initialize, openPackage, confirm, recover: recoverInternal }}>{children}</Context.Provider>;
}
export function useLoginDraft() {
  const context = useContext(Context);
  if (!context) throw new Error('LOGIN_DRAFT_PROVIDER_REQUIRED');
  return context;
}
