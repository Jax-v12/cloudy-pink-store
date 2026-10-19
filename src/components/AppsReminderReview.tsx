'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
type Row = { id: number; orderId: number; daysBefore: number; periodEnd: string; status: string };
async function readReviews(next?: number, signal?: AbortSignal): Promise<{ data: Row[]; pagination: { nextCursor: number | null } }> {
  const r = await fetch('/api/admin/apps/reminders' + (next ? '?cursor=' + next : ''), { signal });
  const j = await r.json(); if (!r.ok || !j.success || !Array.isArray(j.data)) throw new Error(); return j;
}
export default function AppsReminderReview({ onReauth }: { onReauth: () => void }) {
  const { t } = useLanguage(); const a = t.apps;
  const [rows, setRows] = useState<Row[]>([]); const [cursor, setCursor] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [error, setError] = useState(false); const [target, setTarget] = useState<Row | null>(null); const [evidence, setEvidence] = useState('');
  async function load(next?: number) {
    setLoading(true); setError(false);
    try { const j = await readReviews(next); setRows(old => next ? [...old, ...j.data] : j.data); setCursor(j.pagination.nextCursor); }
    catch { setError(true); } finally { setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); readReviews(undefined, controller.signal).then(j => { if (!controller.signal.aborted) { setRows(j.data); setCursor(j.pagination.nextCursor); setLoading(false); } }).catch(() => { if (!controller.signal.aborted) { setError(true); setLoading(false); } }); return () => controller.abort(); }, []);
  async function resolve(e: React.FormEvent) {
    e.preventDefault(); if (!target || busy) return; setBusy(true); setError(false);
    try { const r = await fetch('/api/admin/apps/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: target.id, orderId: target.orderId, evidence }) }); const j = await r.json(); if (j.errorCode === 'REAUTH_REQUIRED') onReauth(); if (!r.ok || !j.success) throw new Error(); setTarget(null); setEvidence(''); await load(); }
    catch { setError(true); } finally { setBusy(false); }
  }
  return <section className="mt-6 space-y-3 rounded-3xl border-2 border-pink-200 bg-white p-5 sm:p-8"><h2 className="text-xl font-bold text-pink-900">{a.reminderReview}</h2><p className="text-sm leading-6">{a.reminderReviewHelp}</p><button disabled={busy} className="rounded-xl border p-3" onClick={() => void load()}>{a.retry}</button>
    {error && <p role="alert">{a.error}</p>}{loading && <p role="status">{t.loadingCatalog}</p>}{!rows.length && !error && !loading && <p>{a.empty}</p>}
    <ul className="space-y-3">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3"><span>#{row.orderId} · H-{row.daysBefore} · {row.periodEnd.slice(0, 10)} · {row.status === 'UNKNOWN' ? a.reminderUnknown : a.reminderRejected}</span><button disabled={busy} className="rounded-xl border p-3" onClick={() => { setTarget(row); setEvidence(''); }}>{a.reminderResolve}</button></li>)}</ul>
    {cursor && <button disabled={busy} className="rounded-xl border p-3" onClick={() => void load(cursor)}>{t.loadMore}</button>}
    {target && <form onSubmit={resolve} className="space-y-3 rounded-xl bg-pink-50 p-4"><p>#{target.orderId}</p><label className="block text-sm font-bold">{a.evidence}<input required maxLength={100} pattern="[A-Za-z0-9:_-]+" value={evidence} onChange={e => setEvidence(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.reminderResolve}</button><button disabled={busy} type="button" onClick={() => setTarget(null)} className="ml-3 rounded-xl border p-3">{a.cancel}</button></form>}
  </section>;
}
