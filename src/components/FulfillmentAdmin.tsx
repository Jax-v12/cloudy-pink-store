'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

type Row = {
  id: number; invoice: string; type: string; status: string; fulfillmentStatus: string; refundStatus: string;
  totalAmount: number; productName: string; variantName: string; units: number; owned: boolean;
  robloxDetail: { method: string; username: string; gamepassUrl: string | null; gamepassPrice: number | null } | null;
  gameDetail: { userId: string; zoneId: string | null } | null;
  job: { evidence: string | null; attempts: { id: number; operation: string; outcome: string; createdAt: string }[] } | null;
  audits: { id: number; action: string; createdAt: string }[];
};
export default function FulfillmentAdmin() {
  const { t } = useLanguage(); const c = t.commerce;
  const label = (value: string) => c[value as keyof typeof c] || value;
  const [rows, setRows] = useState<Row[]>([]); const [type, setType] = useState('ROBLOX'); const [status, setStatus] = useState('');
  const [cursor, setCursor] = useState<number | null>(null); const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<Record<number, string>>({});
  const [secret, setSecret] = useState<{ orderId: number; password: string; backupCodes: string[] } | null>(null);
  const [monitor, setMonitor] = useState<{ overdue: boolean; lastRun: string | null; pendingCount: number; reviewCount: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/fulfillment?type=${type}&status=${status}`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(j => { setRows(j.data); setCursor(j.pagination.nextCursor); setMonitor(j.monitoring); })
      .catch(() => { if (!controller.signal.aborted) setError('SYSTEM_ERROR'); });
    return () => controller.abort();
  }, [type, status, refresh]);
  useEffect(() => {
    if (!secret) return;
    const clear = () => setSecret(null);
    const timer = setTimeout(clear, 60_000);
    window.addEventListener('blur', clear); document.addEventListener('visibilitychange', clear);
    return () => { clearTimeout(timer); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear); };
  }, [secret]);
  async function action(id: number, action: string) {
    setBusy(true); setError(''); setSecret(null);
    try {
      const r = await fetch(`/api/admin/fulfillment/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, evidence: evidence[id] || undefined }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.errorCode);
      if (action === 'reveal') setSecret({ orderId: id, ...j.data });
      else setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'SYSTEM_ERROR'); }
    finally { setBusy(false); }
  }
  async function reauth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(''); const form = e.currentTarget;
    const password = new FormData(form).get('password'); form.reset();
    try { const r = await fetch('/api/admin/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }); if (!r.ok) throw new Error(); }
    catch { setError('REAUTH_REQUIRED'); } finally { setBusy(false); }
  }
  async function more() {
    setBusy(true);
    try { const r = await fetch(`/api/admin/fulfillment?type=${type}&status=${status}&cursor=${cursor}`); if (!r.ok) throw new Error(); const j = await r.json(); setRows(old => [...old, ...j.data]); setCursor(j.pagination.nextCursor); }
    catch { setError('SYSTEM_ERROR'); } finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <h2 className="text-2xl font-bold text-pink-800">{c.fulfillmentAdmin}</h2>
    {monitor && <div className="bg-pink-100 p-4 rounded-xl text-sm space-y-1">
      <p>{c.pendingCount}: {monitor.pendingCount} · {c.reviewCount}: {monitor.reviewCount}</p>
      <p>{c.lastRun}: {monitor.lastRun ? new Date(monitor.lastRun).toLocaleString() : c.noData}</p>
      {monitor.overdue && <p role="status" className="text-amber-800">{c.overdue}</p>}
    </div>}
    <div className="flex flex-wrap gap-3">
      <select aria-label={c.product} value={type} onChange={e => setType(e.target.value)} className="border p-2 rounded-lg"><option value="">{c.all}</option><option value="ROBLOX">{c.ROBLOX}</option><option value="GAME">{c.GAME}</option><option value="APPS">{c.APPS}</option></select>
      <select aria-label={c.fulfillment} value={status} onChange={e => setStatus(e.target.value)} className="border p-2 rounded-lg"><option value="">{c.all}</option>{['NOT_READY', 'QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'COMPLETED', 'REQUIRES_REVIEW'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
      <button onClick={() => { setSecret(null); setRefresh(n => n + 1); }} className="p-2 border rounded-lg">{c.refresh}</button>
    </div>
    <form onSubmit={reauth} className="flex flex-wrap gap-3 items-end">
      <label>{c.adminPassword}<input name="password" type="password" autoComplete="current-password" required className="block p-2 border rounded-lg" /></label>
      <button disabled={busy} className="bg-pink-600 text-white p-2 rounded-lg disabled:opacity-50">{c.reauth}</button>
    </form>
    {error && <p role="alert" className="p-3 rounded-lg bg-rose-100 text-rose-800">{error === 'REAUTH_REQUIRED' ? c.reauthNeeded : error === 'SECRET_UNAVAILABLE' ? c.secretUnavailable : c.actionError}</p>}
    {rows.length === 0 && <p>{c.noData}</p>}
    {rows.map(row => <article key={row.id} className="border border-pink-200 rounded-2xl p-5 space-y-3 bg-white">
      <h3 className="font-bold break-all">{row.invoice}</h3>
      <p>{row.productName} · {row.variantName} · {row.units}</p>
      <p>{c.payment}: {label(row.status)} · {c.fulfillment}: {label(row.fulfillmentStatus)} · {c.refund}: {label(row.refundStatus)}</p>
      {row.robloxDetail && <div className="space-y-1">
        <p>{c.method}: {label(row.robloxDetail.method)} · {c.username}: {row.robloxDetail.username}</p>
        {row.robloxDetail.gamepassUrl && <a className="text-pink-700 underline break-all" href={row.robloxDetail.gamepassUrl} target="_blank" rel="noopener noreferrer">{c.gamepassUrl}</a>}
        {row.robloxDetail.gamepassPrice && <p>{c.gamepassPrice}: {row.robloxDetail.gamepassPrice}</p>}
      </div>}
      {row.gameDetail && <p>{c.userId}: {row.gameDetail.userId} · {c.zoneId}: {row.gameDetail.zoneId}</p>}
      {row.fulfillmentStatus !== 'COMPLETED' && row.refundStatus !== 'COMPLETED' && <>
        <label className="block text-sm">{c.evidence}<input maxLength={1000} value={evidence[row.id] || ''} onChange={e => setEvidence(old => ({ ...old, [row.id]: e.target.value }))} className="block w-full border rounded-lg p-2 mt-1" /></label>
        <div className="flex flex-wrap gap-2">
          {row.type === 'ROBLOX' && row.status === 'PAID' && row.refundStatus === 'NONE' && <>
            {!row.owned ? <button disabled={busy} onClick={() => action(row.id, 'claim')} className="border rounded-lg p-2">{c.claim}</button> : <>
              {(['waiting', 'resume', 'review', 'complete'] as const).map(a => <button key={a} disabled={busy || (a === 'complete' && !evidence[row.id])} onClick={() => action(row.id, a)} className="border rounded-lg p-2 disabled:opacity-40">{c[a]}</button>)}
              {row.robloxDetail?.method === 'LOGIN' && row.fulfillmentStatus === 'PROCESSING' && <button disabled={busy} onClick={() => action(row.id, 'reveal')} className="border rounded-lg p-2">{c.reveal}</button>}
            </>}
          </>}
          {row.type === 'GAME' && row.fulfillmentStatus === 'REQUIRES_REVIEW' && row.refundStatus === 'NONE' && <button disabled={busy || !evidence[row.id]} onClick={() => action(row.id, 'resolve-game')} className="border rounded-lg p-2 disabled:opacity-40">{c.complete}</button>}
          {(row.status === 'PAID' || row.refundStatus === 'REQUIRED') && <button disabled={busy || (row.refundStatus === 'REQUIRED' && !evidence[row.id])} onClick={() => action(row.id, row.refundStatus === 'REQUIRED' ? 'refund-completed' : 'refund-required')} className="border rounded-lg p-2 disabled:opacity-40">{row.refundStatus === 'REQUIRED' ? c.refundCompleted : c.refundRequired}</button>}
        </div>
      </>}
      {secret?.orderId === row.id && <div role="region" aria-label={c.reveal} className="bg-amber-50 border border-amber-300 rounded-xl p-4">
        <p className="break-all">{c.password}: {secret.password}</p><p>{c.backupCodes}</p><ul>{secret.backupCodes.map((code, i) => <li key={i} className="font-mono">{code}</li>)}</ul>
        <button onClick={() => setSecret(null)} className="mt-3 underline">{c.close}</button>
      </div>}
      {row.job?.evidence && <p className="break-all">{c.evidence}: {row.job.evidence}</p>}
      <details><summary className="cursor-pointer">{c.attempts}</summary>{row.job?.attempts.map(a => <p key={a.id}>{label(a.operation)} · {label(a.outcome)} · {new Date(a.createdAt).toLocaleString()}</p>)}</details>
      <details><summary className="cursor-pointer">{c.audit}</summary>{row.audits.map(a => <p key={a.id}>{label(a.action)} · {new Date(a.createdAt).toLocaleString()}</p>)}</details>
    </article>)}
    {cursor && <button disabled={busy} onClick={more} className="border rounded-xl p-3">{t.loadMore}</button>}
  </section>;
}
