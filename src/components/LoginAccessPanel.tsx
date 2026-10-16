'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { normalizeLoginBackupCodes, validLoginPassword, type LoginCredentials } from '@/lib/loginCredentials';
import AdminDialog from './AdminDialog';

type Access = LoginCredentials & { username: string; displayUntil: string };
const control = 'mt-2 w-full min-w-0 rounded-xl border-2 border-pink-200 bg-white p-3 text-neutral-900 focus-visible:outline-2 focus-visible:outline-pink-800';

export default function LoginAccessPanel({ orderId, invoice, username }: { orderId: number; invoice: string; username: string }) {
  const { t } = useLanguage(); const l = t.loginFlow;
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [reauth, setReauth] = useState(false);
  const [adminPassword, setAdminPassword] = useState(''), [error, setError] = useState('');
  const [access, setAccess] = useState<Access | null>(null), [visible, setVisible] = useState(false);
  const request = useRef<AbortController | null>(null), epoch = useRef(0);
  const close = useCallback(() => {
    epoch.current++; request.current?.abort(); request.current = null;
    setAccess(null); setAdminPassword(''); setVisible(false); setReauth(false); setError(''); setBusy(false); setOpen(false);
  }, []);
  useEffect(() => () => { epoch.current++; request.current?.abort(); }, []);
  useEffect(() => {
    if (!open) return;
    const hide = () => { if (document.hidden) close(); };
    document.addEventListener('visibilitychange', hide);
    const timer = access ? setTimeout(close, Math.max(0, Math.min(60_000, Date.parse(access.displayUntil) - Date.now()))) : null;
    return () => { document.removeEventListener('visibilitychange', hide); if (timer !== null) clearTimeout(timer); };
  }, [open, access, close]);

  async function unlock() {
    if (request.current || access) return;
    const controller = new AbortController(); request.current = controller; const current = epoch.current;
    setBusy(true); setError('');
    try {
      if (reauth) {
        const response = await fetch('/api/admin/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: adminPassword }), signal: controller.signal, cache: 'no-store' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
        if (controller.signal.aborted || epoch.current !== current) return;
        setAdminPassword(''); setReauth(false);
      }
      const response = await fetch(`/api/admin/fulfillment/${orderId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reveal' }), signal: controller.signal, cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
      if (controller.signal.aborted || epoch.current !== current) return;
      const value: unknown = result.data;
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('SYSTEM_ERROR');
      const data = value as Record<string, unknown>, codes = normalizeLoginBackupCodes(data.backupCodes);
      if (data.username !== username || !validLoginPassword(data.password) || !codes || typeof data.displayUntil !== 'string' || !Number.isFinite(Date.parse(data.displayUntil)) || Date.parse(data.displayUntil) <= Date.now()) throw new Error('LOGIN_ACCESS_UNAVAILABLE');
      setAccess({ username, password: data.password, backupCodes: codes, displayUntil: data.displayUntil });
    } catch (cause) {
      if (controller.signal.aborted || epoch.current !== current) return;
      const code = cause instanceof Error ? cause.message : 'SYSTEM_ERROR';
      if (code === 'REAUTH_REQUIRED') setReauth(true);
      setAdminPassword(''); setAccess(null); setError(code);
    } finally {
      if (epoch.current === current) { request.current = null; setBusy(false); }
    }
  }

  const errorMessage = error === 'REAUTH_REQUIRED' ? l.reauthRequired
    : error === 'INVALID_CREDENTIALS' ? t.commerce.INVALID_CREDENTIALS
    : error === 'RATE_LIMIT_EXCEEDED' ? t.commerce.RATE_LIMIT_EXCEEDED
    : error === 'LOGIN_ACCESS_UNAVAILABLE' || error === 'UNAUTHORIZED' ? l.accessUnavailable : l.accessFailed;
  return <div className="mt-3">
    <button type="button" className="rounded-xl border-2 border-pink-300 bg-white px-4 py-3 font-bold text-pink-900 focus-visible:outline-2 focus-visible:outline-pink-800" onClick={() => setOpen(true)}>{l.openAccess}</button>
    {open && <AdminDialog title={l.accessTitle} busy={false} onClose={close}>
      <p className="mb-3 break-all font-bold text-neutral-900">{invoice}</p>
      <p className="mb-4 text-sm text-neutral-700">{l.accessInstructions}</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-3 text-rose-900">{errorMessage}</p>}
      {access ? <div className="space-y-3">
        <p className="break-all font-semibold text-neutral-800">{l.username}: {access.username}</p>
        <label className="block font-semibold text-neutral-800">{l.password}<input aria-label={l.password} className={control} type={visible ? 'text' : 'password'} value={access.password} readOnly autoComplete="off" spellCheck={false} /></label>
        {access.backupCodes.map((code, index) => <label key={index} className="block font-semibold text-neutral-800">{l.backupCode} {index + 1}<input aria-label={`${l.backupCode} ${index + 1}`} className={control} type={visible ? 'text' : 'password'} value={code} readOnly autoComplete="off" spellCheck={false} /></label>)}
        <button type="button" className="rounded-xl border-2 border-pink-300 px-4 py-3 font-bold text-pink-900" aria-pressed={visible} onClick={() => setVisible(value => !value)}>{visible ? l.hide : l.show}</button>
        <p role="status" className="text-sm text-neutral-700">{l.accessExpiry}</p>
      </div> : <form autoComplete="off" onSubmit={event => { event.preventDefault(); void unlock(); }}>
        {reauth && <label className="mb-4 block font-semibold text-neutral-800">{l.reauthLabel}<input autoFocus type="password" autoComplete="off" className={control} value={adminPassword} onChange={event => setAdminPassword(event.target.value)} maxLength={1024} disabled={busy} /></label>}
        <button type="submit" className="rounded-xl bg-pink-800 px-4 py-3 font-bold text-white disabled:opacity-50" disabled={busy || (reauth && !adminPassword)}>{busy ? l.processing : l.revealAccess}</button>
      </form>}
      <button type="button" className="mt-5 rounded-xl border-2 border-pink-300 px-4 py-3 font-bold text-pink-900" onClick={close}>{l.close}</button>
    </AdminDialog>}
  </div>;
}
