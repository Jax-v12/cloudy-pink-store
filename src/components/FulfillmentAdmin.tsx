'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { formatMoney, type Currency, type Region } from '@/lib/regionalPricing';

type Row = {
  id: number; invoice: string; type: string; status: string; fulfillmentStatus: string; refundStatus: string;
  totalAmount: number; currency: Currency; pricingRegion: Region; productName: string; variantName: string; units: number; owned: boolean; contactEmail: string | null;
  paymentMethod?: string;
  robloxDetail: { method: string; username: string; gamepassUrl: string | null; gamepassPrice: number | null; robloxUserId: string | null; gamepassVerifiedAt: string | null } | null;
  gameDetail: { userId: string; zoneId: string | null } | null;
  job: { evidence: string | null; attempts: { id: number; operation: string; outcome: string; createdAt: string }[] } | null;
  audits: { id: number; action: string; createdAt: string }[];
};
export default function FulfillmentAdmin() {
  const { t, language } = useLanguage(); const c = t.commerce; const ops = t.robloxOps;
  const label = (value: string) => value === 'QUEUED' ? ops.ready : value === 'WAITING_CUSTOMER' ? ops.waiting : value === 'assisted-login-required' ? ops.assistedAudit : c[value as keyof typeof c] || value;
  const [rows, setRows] = useState<Row[]>([]); const [type, setType] = useState('ROBLOX'); const [status, setStatus] = useState('');
  const [method, setMethod] = useState(''); const [payment, setPayment] = useState('');
  const [search, setSearch] = useState(''); const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true); const activeRequest = useRef<AbortController | null>(null);
  const filters = new URLSearchParams({ type, status, method, payment, q: query }).toString();
  const [cursor, setCursor] = useState<number | null>(null); const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<Record<number, string>>({});
  const [monitor, setMonitor] = useState<{ overdue: boolean; lastRun: string | null; pendingCount: number; reviewCount: number } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); activeRequest.current = controller;
    setLoading(true); setError(''); setCursor(null); setRows([]); setMonitor(null);
    fetch('/api/admin/fulfillment?' + filters, { signal: controller.signal }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(r.status === 401 ? 'UNAUTHORIZED' : 'LOAD_FAILED'); return j; })
      .then(j => { if (!controller.signal.aborted) { setRows(j.data); setCursor(j.pagination.nextCursor); setMonitor(j.monitoring); } })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'LOAD_FAILED'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [filters, refresh]);
  async function action(id: number, action: string) {
    setBusy(true); setError('');
    try {
      const r = await fetch(`/api/admin/fulfillment/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, evidence: evidence[id] || undefined }) });
      const j = await r.json(); if (!r.ok) throw new Error(j.errorCode);
      setRefresh(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'SYSTEM_ERROR'); }
    finally { setBusy(false); }
  }
  async function more() {
    if (!cursor || busy || loading) return;
    setBusy(true); const current = activeRequest.current;
    try {
      const r = await fetch('/api/admin/fulfillment?' + filters + '&cursor=' + cursor);
      if (!r.ok) throw new Error(r.status === 401 ? 'UNAUTHORIZED' : 'LOAD_FAILED'); const j = await r.json();
      if (current && !current.signal.aborted) { setRows(old => [...old, ...j.data]); setCursor(j.pagination.nextCursor); }
    } catch (e) { if (current && !current.signal.aborted) setError(e instanceof Error ? e.message : 'LOAD_FAILED'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5">
    <h2 className="text-2xl font-bold text-pink-800">{c.fulfillmentAdmin}</h2>
    <p className="text-sm text-neutral-600">{ops.queueIntro}</p>
    {monitor && <div className="bg-pink-100 p-4 rounded-xl text-sm space-y-1">
      <p>{c.pendingCount}: {monitor.pendingCount} · {c.reviewCount}: {monitor.reviewCount}</p>
      <details><summary className="cursor-pointer">{ops.diagnostics}</summary><p>{c.lastRun}: {monitor.lastRun ? new Date(monitor.lastRun).toLocaleString() : c.noData}</p>
      {monitor.overdue && <p role="status" className="text-amber-800">{c.overdue}</p>}</details>
    </div>}
    <div className="flex flex-wrap gap-3">
      <select aria-label={c.product} value={type} onChange={e => { setType(e.target.value); setMethod(''); }} className="border p-2 rounded-lg"><option value="">{c.all}</option><option value="ROBLOX">{c.ROBLOX}</option><option value="GAME">{c.GAME}</option><option value="APPS">{c.APPS}</option></select>
      <select aria-label={c.fulfillment} value={status} onChange={e => setStatus(e.target.value)} className="border p-2 rounded-lg"><option value="">{c.all}</option>{['NOT_READY', 'QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'COMPLETED', 'REQUIRES_REVIEW'].map(s => <option key={s} value={s}>{label(s)}</option>)}</select>
      {(!type || type === 'ROBLOX') && <select aria-label={ops.method} value={method} onChange={e => setMethod(e.target.value)} className="border p-2 rounded-lg"><option value="">{ops.method}: {c.all}</option>{['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'].map(m => <option key={m} value={m}>{label(m)}</option>)}</select>}
      <select aria-label={c.payment} value={payment} onChange={e => setPayment(e.target.value)} className="border p-2 rounded-lg"><option value="">{c.payment}: {c.all}</option>{['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'].map(p => <option key={p} value={p}>{label(p)}</option>)}</select>
      <button disabled={loading} onClick={() => setRefresh(n => n + 1)} className="p-2 border rounded-lg">{c.refresh}</button>
    </div>
    <form onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }} className="flex flex-wrap gap-3 items-end">
      <label className="flex-1 min-w-48 text-sm">{ops.search}<input type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={120} className="block w-full p-2 border rounded-lg" /></label>
      <button className="bg-pink-600 text-white p-2 rounded-lg">{ops.searchButton}</button>
      {query && <button type="button" onClick={() => { setSearch(''); setQuery(''); }} className="p-2 border rounded-lg">{ops.clear}</button>}
    </form>
    {error && <p role="alert" className="p-3 rounded-lg bg-rose-100 text-rose-800">{error === 'UNAUTHORIZED' ? t.regional.adminSessionExpired : error === 'LOAD_FAILED' ? t.regional.adminLoadError : c.actionError}</p>}
    {loading && <p role="status">{ops.loading}</p>}
    {!loading && !error && rows.length === 0 && <p>{ops.empty}</p>}
    {rows.map(row => <article key={row.id} className="border border-pink-200 rounded-2xl p-5 space-y-3 bg-white">
      <h3 className="font-bold break-all">{row.invoice}</h3>
      <p>{row.productName} · {row.variantName} · {row.units}</p>
      <p>{t.regional.region}: {t.regional[row.pricingRegion]} · {formatMoney(row.totalAmount, row.currency, language)}</p>
      <div className="bg-pink-50/50 border border-pink-100 rounded-xl p-3 text-xs text-neutral-600 space-y-1">
        <div className="font-semibold text-neutral-700">{t.regional.regionalMonitoring}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
          <div><span className="text-neutral-500">{t.regional.region}:</span> {row.pricingRegion ? (t.regional[row.pricingRegion] || row.pricingRegion) : t.regional.notAvailable} ({row.currency})</div>
          <div><span className="text-neutral-500">{t.regional.paymentMethod}:</span> {row.paymentMethod || t.regional.notAvailable}</div>
          <div><span className="text-neutral-500">{t.regional.payerCountry}:</span> <span className="text-neutral-700">{t.regional.payerCountryUnavailable}</span></div>
          <div><span className="text-neutral-500">{t.regional.vpnCheck}:</span> <span className="text-neutral-700">{t.regional.vpnUnassessed}</span></div>
        </div>
      </div>
      <p>{c.payment}: {label(row.status)} · {c.fulfillment}: {label(row.fulfillmentStatus)} · {c.refund}: {label(row.refundStatus)}</p>
      {row.contactEmail && <p className="break-all">{c.email}: {row.contactEmail}</p>}
      {row.robloxDetail && <div className="space-y-1">
        <p>{c.method}: {label(row.robloxDetail.method)} · {c.username}: {row.robloxDetail.username}</p>
        {row.robloxDetail.method === 'LOGIN' && <p className="rounded-xl bg-pink-50 p-3">{ops.loginNext}</p>}
        {row.robloxDetail.gamepassUrl && <a className="text-pink-700 underline break-all" href={row.robloxDetail.gamepassUrl} target="_blank" rel="noopener noreferrer">{c.gamepassUrl}</a>}
        {(!row.robloxDetail.robloxUserId || (row.robloxDetail.method === 'GAMEPASS' && !row.robloxDetail.gamepassVerifiedAt)) && <p className="text-amber-900 font-medium">{t.roblox.manualCheck}</p>}
        {row.robloxDetail.gamepassVerifiedAt && <p className="text-emerald-800">{t.roblox.checkedAtCheckout}</p>}
        {row.robloxDetail.gamepassPrice && <p>{c.gamepassPrice}: {row.robloxDetail.gamepassPrice}</p>}
      </div>}
      {row.gameDetail && <p>{c.userId}: {row.gameDetail.userId} · {c.zoneId}: {row.gameDetail.zoneId}</p>}
      {row.fulfillmentStatus !== 'COMPLETED' && row.refundStatus !== 'COMPLETED' && <>
        <label className="block text-sm">{c.evidence}<input maxLength={1000} value={evidence[row.id] || ''} onChange={e => setEvidence(old => ({ ...old, [row.id]: e.target.value }))} className="block w-full border rounded-lg p-2 mt-1" /></label>
        <div className="flex flex-wrap gap-2">
          {row.type === 'ROBLOX' && row.status === 'PAID' && row.refundStatus === 'NONE' && <>
            {!row.owned ? <button disabled={busy} onClick={() => action(row.id, 'claim')} className="border rounded-lg p-2">{c.claim}</button> : <>
              {(['waiting', 'resume', 'review', 'complete'] as const).filter(a => ({ waiting: ['PROCESSING'], resume: ['WAITING_CUSTOMER', 'REQUIRES_REVIEW'], review: ['PROCESSING', 'WAITING_CUSTOMER'], complete: ['PROCESSING', 'WAITING_CUSTOMER'] }[a].includes(row.fulfillmentStatus))).map(a => <button key={a} disabled={busy || (a === 'complete' && !evidence[row.id])} onClick={() => action(row.id, a)} className="border rounded-lg p-2 disabled:opacity-40">{c[a]}</button>)}
            </>}
          </>}
          {row.type === 'GAME' && row.fulfillmentStatus === 'REQUIRES_REVIEW' && row.refundStatus === 'NONE' && <button disabled={busy || !evidence[row.id]} onClick={() => action(row.id, 'resolve-game')} className="border rounded-lg p-2 disabled:opacity-40">{c.complete}</button>}
          {(row.status === 'PAID' || row.refundStatus === 'REQUIRED') && <button disabled={busy || (row.refundStatus === 'REQUIRED' && !evidence[row.id])} onClick={() => action(row.id, row.refundStatus === 'REQUIRED' ? 'refund-completed' : 'refund-required')} className="border rounded-lg p-2 disabled:opacity-40">{row.refundStatus === 'REQUIRED' ? c.refundCompleted : c.refundRequired}</button>}
        </div>
      </>}
      {row.job?.evidence && <p className="break-all">{c.evidence}: {row.job.evidence}</p>}
      <details><summary className="cursor-pointer">{c.attempts}</summary>{row.job?.attempts.map(a => <p key={a.id}>{label(a.operation)} · {label(a.outcome)} · {new Date(a.createdAt).toLocaleString()}</p>)}</details>
      <details><summary className="cursor-pointer">{c.audit}</summary>{row.audits.map(a => <p key={a.id}>{label(a.action)} · {new Date(a.createdAt).toLocaleString()}</p>)}</details>
    </article>)}
    {cursor && <button disabled={busy} onClick={more} className="border rounded-xl p-3">{t.loadMore}</button>}
  </section>;
}
