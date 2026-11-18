'use client';
import { useId, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { readInvoiceAccess } from '@/lib/invoiceBrowser';
export type ReminderState = { reminderOptIn?: boolean; reminderVerified?: boolean; remindersAvailable?: boolean };
export default function AppsReminderPanel({ invoice, service, refresh }: { invoice: string; service: ReminderState; refresh: () => void }) {
  const { t, language } = useLanguage(); const a = t.apps;
  const fieldId = useId();
  const [phone, setPhone] = useState(''); const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const lock = useRef(false);
  async function save(enabled: boolean) {
    if (lock.current) return; lock.current = true; setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(invoice)}/reminders`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-order-token': readInvoiceAccess(invoice) || '' },
        body: JSON.stringify(enabled ? { enabled, phone, consent, language } : { enabled }) });
      if (!response.ok || !(await response.json()).success) throw new Error();
      setPhone(''); setConsent(false); refresh();
    } catch { setError(true); } finally { lock.current = false; setBusy(false); }
  }
  return <div className="space-y-3 rounded-xl border border-pink-200 p-4">
    <h3 className="font-bold">{a.reminders}</h3>
    {service.reminderOptIn ? <><p role="status" className="text-sm">{!service.remindersAvailable ? a.reminderUnavailable : service.reminderVerified ? a.reminderActive : a.reminderPending}</p><button disabled={busy} onClick={() => void save(false)} className="rounded-xl border border-pink-300 p-3 font-bold">{a.reminderDisable}</button></>
      : service.remindersAvailable ? <form onSubmit={e => { e.preventDefault(); void save(true); }} className="space-y-3"><label htmlFor={`${fieldId}-phone`} className="block text-sm font-bold">{a.reminderPhone}</label><input id={`${fieldId}-phone`} name="phone" required type="tel" autoComplete="tel" inputMode="tel" maxLength={64} value={phone} onChange={e => setPhone(e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-[var(--input-border)] p-3 text-base sm:text-sm" /><label htmlFor={`${fieldId}-consent`} className="flex items-start gap-3 text-sm leading-6 cursor-pointer"><input id={`${fieldId}-consent`} name="consent" required type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-pink-600" /><span>{a.reminderConsent}</span></label><button type="submit" disabled={busy || !consent} className="min-h-11 rounded-xl bg-pink-700 p-3 font-bold text-white disabled:opacity-50">{busy ? a.processing : a.reminderEnable}</button></form>
        : <p className="text-sm">{a.reminderUnavailable}</p>}
    {error && <p role="alert" className="text-sm text-rose-800">{a.error}</p>}
  </div>;
}
