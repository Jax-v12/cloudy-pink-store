'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { formatMoney, type Currency, type Region } from '@/lib/regionalPricing';
import AdminDialog from './AdminDialog';

type Row = {
  id: number; invoice: string; type: string; status: string; fulfillmentStatus: string; refundStatus: string;
  totalAmount: number; currency: Currency; pricingRegion: Region; productName: string; variantName: string; units: number; owned: boolean; contactEmail: string | null;
  paymentMethod?: string;
  archivedAt: string | null; canArchive: boolean; archiveReasonCodes: string[]; canRemove: boolean; removeReasonCodes: string[]; removedFromAdminAt: string | null;
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
  const [archive, setArchive] = useState('active');
  const [archiveTarget, setArchiveTarget] = useState<Row | null>(null);
  const [archiveError, setArchiveError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<Row | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState('');
  const [removePassword, setRemovePassword] = useState('');
  const [removeReauth, setRemoveReauth] = useState(false);
  const removing = useRef(false);
  const [search, setSearch] = useState(''); const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true); const activeRequest = useRef<AbortController | null>(null);
  const filters = new URLSearchParams({ type, status, method, payment, archive, q: query }).toString();
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
  async function changeRemove(row: Row, removed: boolean) {
    if (busy || removing.current) return;
    removing.current = true;
    setBusy(true); setArchiveError('');
    try {
      // Try removal first; a valid recent session must not consume another password attempt.
      if (removed && removeReauth) {
        const reauth = await fetch('/api/admin/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: removePassword }) });
        const result = await reauth.json();
        if (!reauth.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
        setRemoveReauth(false); setRemovePassword('');
      }
      const response = await fetch(`/api/admin/fulfillment/${row.id}/remove`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removed, ...(removed ? { confirmationInvoice: removeConfirm } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
      closeRemove();
    } catch (e) {
      const code = e instanceof Error ? e.message : 'SYSTEM_ERROR';
      if (code === 'REAUTH_REQUIRED') setRemoveReauth(true);
      setArchiveError(code);
    } finally { removing.current = false; setBusy(false); setRefresh(n => n + 1); }
  }
  function closeRemove() {
    setRemoveTarget(null); setRemoveConfirm(''); setRemovePassword(''); setRemoveReauth(false); setArchiveError('');
  }

  async function changeArchive(row: Row, archived: boolean) {
    if (busy) return;
    setBusy(true); setArchiveError('');
    try {
      const response = await fetch(`/api/admin/fulfillment/${row.id}/archive`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ archived }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
    } catch (e) { setArchiveError(e instanceof Error ? e.message : 'SYSTEM_ERROR'); }
    finally { setArchiveTarget(null); setBusy(false); setRefresh(n => n + 1); }
  }
  return <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-pink-100 pb-5">
      <div>
        <h2 className="text-3xl text-pink-800 font-black tracking-tight">{c.fulfillmentAdmin}</h2>
        <p className="text-neutral-500 mt-2 font-medium">{ops.queueIntro}</p>
      </div>
      <button disabled={loading} onClick={() => setRefresh(n => n + 1)} className="flex items-center gap-2 rounded-xl border-2 border-pink-200 px-4 py-2 text-sm font-bold text-pink-600 hover:bg-pink-50 transition active:scale-95 disabled:opacity-50">
        <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        {c.refresh}
      </button>
    </div>

    {removeTarget && <AdminDialog title={c.confirmRemove} busy={busy} onClose={closeRemove}>
      <p className="mb-3 break-all font-black text-lg text-neutral-800">{removeTarget.invoice}</p>
      <dl className="mb-4 text-sm text-neutral-700 space-y-1">
        <div><dt className="inline font-bold">{c.product}: </dt><dd className="inline break-words">{removeTarget.productName}</dd></div>
        <div><dt className="inline font-bold">{c.payment}: </dt><dd className="inline">{label(removeTarget.status)}</dd></div>
        <div><dt className="inline font-bold">{c.fulfillment}: </dt><dd className="inline">{label(removeTarget.fulfillmentStatus)}</dd></div>
      </dl>
      <p className="mb-5 text-sm font-medium text-neutral-600">{c.confirmRemoveDesc}</p>
      <form onSubmit={e => { e.preventDefault(); if (removeConfirm === removeTarget.invoice && (!removeReauth || removePassword)) void changeRemove(removeTarget, true); }}>
      <label className="block text-sm font-bold text-neutral-700">{c.confirmInvoice}
        <input type="text" disabled={busy} autoComplete="off" maxLength={191} value={removeConfirm} onChange={e => setRemoveConfirm(e.target.value)} className="w-full border-2 border-neutral-200 rounded-xl px-4 py-3 text-sm font-bold text-neutral-800 focus:border-red-500 focus:outline-none transition-all mt-1 mb-4" />
      </label>
      {removeReauth && <label className="block text-sm font-bold text-neutral-700">{c.adminPassword}
        <input type="password" disabled={busy} autoComplete="current-password" maxLength={1024} value={removePassword} onChange={e => setRemovePassword(e.target.value)} className="w-full border-2 border-pink-200 rounded-xl px-4 py-3 mt-1 mb-4 focus:border-pink-500 focus:outline-none" />
      </label>}
      {archiveError && <p role="alert" className="mb-4 text-sm text-rose-700">{c[archiveError as keyof typeof c] || c.SYSTEM_ERROR}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={busy || removeConfirm !== removeTarget.invoice || (removeReauth && !removePassword)} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl p-3 shadow-sm transition active:scale-95 disabled:opacity-50">{c.removeInvoice}</button>
        <button type="button" disabled={busy} onClick={closeRemove} className="flex-1 border-2 border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50 rounded-xl p-3 transition active:scale-95">{c.cancelAction}</button>
      </div>
      </form>
    </AdminDialog>}
    {archiveTarget && <AdminDialog title={c.archive} busy={busy} onClose={() => setArchiveTarget(null)}>
      <p className="mb-3 break-all font-black text-lg text-neutral-800">{archiveTarget.invoice}</p>
      <p className="mb-5 text-sm font-medium text-neutral-600">{c.archiveWarning}</p>
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => void changeArchive(archiveTarget, true)} className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold rounded-xl p-3 shadow-sm transition active:scale-95">{c.archive}</button>
        <button disabled={busy} onClick={() => setArchiveTarget(null)} className="flex-1 border-2 border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50 rounded-xl p-3 transition active:scale-95">{c.cancelAction}</button>
      </div>
    </AdminDialog>}

    {monitor && <div className="bg-pink-50 border border-pink-100 p-4 sm:px-6 rounded-2xl flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-pink-100 flex flex-col items-center">
          <span className="text-2xl font-black text-pink-600 leading-none">{monitor.pendingCount}</span>
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">{c.pendingCount}</span>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-pink-100 flex flex-col items-center">
          <span className="text-2xl font-black text-amber-500 leading-none">{monitor.reviewCount}</span>
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mt-1">{c.reviewCount}</span>
        </div>
      </div>
      <details className="text-sm font-medium group text-neutral-600 w-full sm:w-auto">
        <summary className="cursor-pointer font-bold hover:text-pink-600 transition select-none list-none flex items-center gap-1 justify-end">
          {ops.diagnostics}
          <svg className="w-4 h-4 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
        </summary>
        <div className="pt-2 text-right">
          <p>{c.lastRun}: <span className="font-semibold text-neutral-800">{monitor.lastRun ? new Date(monitor.lastRun).toLocaleString() : c.noData}</span></p>
          {monitor.overdue && <p role="status" className="text-rose-600 font-bold mt-1 animate-pulse">{c.overdue}</p>}
        </div>
      </details>
    </div>}

    <div className="bg-white border-2 border-pink-100 rounded-3xl p-5 shadow-lg shadow-pink-900/5 flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <select aria-label={c.archiveView} value={archive} disabled={busy} onChange={e => { setArchive(e.target.value); setArchiveError(''); }} className="border-2 border-pink-100 bg-neutral-50 rounded-xl px-3 py-2 text-sm font-bold text-neutral-700 hover:border-pink-200 focus:border-pink-500 focus:outline-none transition-all">
          <option value="active">{c.activeOrders}</option><option value="archived">{c.archivedOrders}</option><option value="removed">{c.removedView}</option><option value="all">{c.all}</option>
        </select>
        <select aria-label={c.product} value={type} onChange={e => { setType(e.target.value); setMethod(''); }} className="border-2 border-pink-100 bg-neutral-50 rounded-xl px-3 py-2 text-sm font-bold text-neutral-700 hover:border-pink-200 focus:border-pink-500 focus:outline-none transition-all">
          <option value="">{c.all}</option><option value="ROBLOX">{c.ROBLOX}</option><option value="GAME">{c.GAME}</option><option value="APPS">{c.APPS}</option>
        </select>
        <select aria-label={c.fulfillment} value={status} onChange={e => setStatus(e.target.value)} className="border-2 border-pink-100 bg-neutral-50 rounded-xl px-3 py-2 text-sm font-bold text-neutral-700 hover:border-pink-200 focus:border-pink-500 focus:outline-none transition-all">
          <option value="">{c.all}</option>{['NOT_READY', 'QUEUED', 'PROCESSING', 'WAITING_CUSTOMER', 'COMPLETED', 'REQUIRES_REVIEW'].map(s => <option key={s} value={s}>{label(s)}</option>)}
        </select>
        {(!type || type === 'ROBLOX') && <select aria-label={ops.method} value={method} onChange={e => setMethod(e.target.value)} className="border-2 border-pink-100 bg-neutral-50 rounded-xl px-3 py-2 text-sm font-bold text-neutral-700 hover:border-pink-200 focus:border-pink-500 focus:outline-none transition-all">
          <option value="">{ops.method}: {c.all}</option>{['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'].map(m => <option key={m} value={m}>{label(m)}</option>)}
        </select>}
        <select aria-label={c.payment} value={payment} onChange={e => setPayment(e.target.value)} className="border-2 border-pink-100 bg-neutral-50 rounded-xl px-3 py-2 text-sm font-bold text-neutral-700 hover:border-pink-200 focus:border-pink-500 focus:outline-none transition-all">
          <option value="">{c.payment}: {c.all}</option>{['PENDING', 'PAID', 'EXPIRED', 'CANCELLED'].map(p => <option key={p} value={p}>{label(p)}</option>)}
        </select>
      </div>

      <form onSubmit={e => { e.preventDefault(); setQuery(search.trim()); }} className="flex flex-wrap gap-3 items-end pt-2 border-t border-pink-50">
        <label className="flex-1 min-w-[200px] text-xs font-bold text-neutral-600 block">
          {ops.search}
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} maxLength={120} className="mt-1 block w-full border-2 border-pink-100 rounded-xl px-4 py-2.5 text-sm bg-white focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-50 transition-all shadow-inner" placeholder="Invoice ID, email, username..." />
        </label>
        <button className="bg-pink-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-pink-700 shadow-sm transition active:scale-95">{ops.searchButton}</button>
        {query && <button type="button" onClick={() => { setSearch(''); setQuery(''); }} className="border-2 border-neutral-200 text-neutral-600 font-bold px-4 py-2.5 rounded-xl hover:bg-neutral-50 transition active:scale-95">{ops.clear}</button>}
      </form>
    </div>
    {error && <p role="alert" className="p-3 rounded-lg bg-rose-100 text-rose-800">{error === 'UNAUTHORIZED' ? t.regional.adminSessionExpired : error === 'LOAD_FAILED' ? t.regional.adminLoadError : c.actionError}</p>}
    {archiveError && !removeTarget && <p role="alert" className="p-3 rounded-lg bg-rose-100 text-rose-800">{c[archiveError as keyof typeof c] || c.SYSTEM_ERROR}</p>}
        {loading && <div className="flex justify-center p-8"><svg className="h-8 w-8 text-pink-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></div>}

    {!loading && !error && rows.length === 0 && (
      <div className="flex flex-col items-center justify-center p-16 text-center bg-white border-2 border-dashed border-pink-200 rounded-[2.5rem] shadow-inner">
        <svg className="w-16 h-16 text-pink-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
        <p className="text-lg font-bold text-neutral-500">{ops.empty}</p>
        <p className="text-sm text-neutral-400 mt-1">Try adjusting your filters</p>
      </div>
    )}

    <div className="space-y-5">
      {rows.map(row => <article key={row.id} className="bg-white border-2 border-pink-100 rounded-[2.5rem] p-6 sm:p-8 shadow-lg shadow-pink-900/5 hover:shadow-2xl hover:shadow-pink-900/10 hover:border-pink-300 hover:-translate-y-1 transition-all duration-300 group">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-pink-50 pb-5 mb-5">
          <div>
            <h3 className="font-black text-xl text-neutral-800 break-all group-hover:text-pink-600 transition-colors">{row.invoice}</h3>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${row.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : row.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600'}`}>
                {c.payment}: {label(row.status)}
              </span>
              <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${row.fulfillmentStatus === 'COMPLETED' ? 'bg-sky-100 text-sky-700' : row.fulfillmentStatus === 'PROCESSING' || row.fulfillmentStatus === 'QUEUED' ? 'bg-pink-100 text-pink-700' : 'bg-neutral-100 text-neutral-600'}`}>
                {c.fulfillment}: {label(row.fulfillmentStatus)}
              </span>
              {row.refundStatus !== 'NONE' && (
                <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${row.refundStatus === 'REQUIRED' ? 'bg-rose-100 text-rose-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {c.refund}: {label(row.refundStatus)}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <p className="text-2xl font-black text-pink-600">{formatMoney(row.totalAmount, row.currency, language)}</p>
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mt-1">{t.regional[row.pricingRegion]} &middot; {row.currency}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{c.product}</p>
              <p className="font-semibold text-neutral-800 mt-1">{row.productName} <span className="text-neutral-300 mx-1">&bull;</span> {row.variantName}</p>
              <p className="text-sm font-bold text-pink-600 mt-0.5">{row.units} {c.units}</p>
            </div>

            {row.contactEmail && (
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{c.email}</p>
                <p className="font-semibold text-neutral-800 break-all mt-1">{row.contactEmail}</p>
              </div>
            )}

            {row.archivedAt ? (
              <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100">
                <p className="text-sm font-medium text-neutral-600">{c.archivedOn}: <span className="font-bold">{new Date(row.archivedAt).toLocaleString()}</span></p>
                {row.removedFromAdminAt && <p className="text-sm font-medium text-red-600 mt-1">{c.removedView}: <span className="font-bold">{new Date(row.removedFromAdminAt).toLocaleString()}</span></p>}
                {!row.removedFromAdminAt && <button disabled={busy || loading} onClick={() => void changeArchive(row, false)} className="mt-2 text-xs font-bold border-2 border-pink-200 text-pink-600 hover:bg-pink-50 rounded-lg px-4 py-2 transition active:scale-95">{c.restore}</button>}
                {row.archivedAt && !row.removedFromAdminAt && <button disabled={busy || loading || !row.canRemove} onClick={() => { setArchiveError(''); setRemoveTarget(row); }} className="mt-2 ml-2 text-xs font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-lg px-4 py-2 transition active:scale-95">{c.removeInvoice}</button>}
                {row.removedFromAdminAt && <button disabled={busy || loading} onClick={() => void changeRemove(row, false)} className="mt-2 text-xs font-bold border-2 border-pink-200 text-pink-600 hover:bg-pink-50 rounded-lg px-4 py-2 transition active:scale-95">{c.restoreRemovedInvoice}</button>}
                {!row.removedFromAdminAt && !row.canRemove && <div className="mt-2 text-sm text-rose-600">{row.removeReasonCodes.map(code => <p key={code}>{c[code as keyof typeof c] || c.actionError}</p>)}</div>}
              </div>
            ) : row.canArchive ? (
              <button disabled={busy || loading} onClick={() => { setArchiveError(''); setArchiveTarget(row); }} className="text-xs font-bold border-2 border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-lg px-4 py-2 transition active:scale-95">{c.archive}</button>
            ) : row.type !== 'APPS' && (
              <details className="text-xs font-medium text-neutral-500 bg-neutral-50 p-3 rounded-xl cursor-pointer">
                <summary className="outline-none">{c.archiveUnavailable}</summary>
                <div className="mt-2 space-y-1">
                  {row.archiveReasonCodes.map(code => <p key={code} className="text-rose-600 font-semibold">{c[code as keyof typeof c] || c.actionError}</p>)}
                </div>
              </details>
            )}
          </div>

          <div className="space-y-4">
            {row.robloxDetail && (
              <div className="bg-pink-50/50 border border-pink-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-pink-400 uppercase tracking-wider mb-2">{c.ROBLOX} {c.productDetails}</p>
                <div className="space-y-2">
                  <p className="text-sm"><span className="font-bold text-neutral-500">{c.method}:</span> <span className="font-semibold text-neutral-800">{label(row.robloxDetail.method)}</span></p>
                  <p className="text-sm"><span className="font-bold text-neutral-500">{c.username}:</span> <span className="font-black text-neutral-900">{row.robloxDetail.username}</span></p>

                  {row.robloxDetail.method === 'LOGIN' && <p className="rounded-xl bg-pink-100 text-pink-800 p-3 text-sm font-medium mt-2">{ops.loginNext}</p>}

                  {row.robloxDetail.gamepassUrl && (
                    <div className="mt-2">
                      <a className="inline-flex items-center gap-1 text-sm font-bold text-pink-600 hover:text-pink-700 bg-white border border-pink-200 px-3 py-1.5 rounded-lg transition" href={row.robloxDetail.gamepassUrl} target="_blank" rel="noopener noreferrer">
                        {c.gamepassUrl}
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </a>
                    </div>
                  )}

                  <div className="pt-2 border-t border-pink-100/50 mt-2 text-xs">
                    {(!row.robloxDetail.robloxUserId || (row.robloxDetail.method === 'GAMEPASS' && !row.robloxDetail.gamepassVerifiedAt)) && <p className="text-amber-700 font-bold flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>{t.roblox.manualCheck}</p>}
                    {row.robloxDetail.gamepassVerifiedAt && <p className="text-emerald-700 font-bold flex items-center gap-1.5"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>{t.roblox.checkedAtCheckout}</p>}
                    {row.robloxDetail.gamepassPrice && <p className="mt-1 font-semibold text-neutral-600">{c.gamepassPrice}: <span className="font-bold text-neutral-800">{row.robloxDetail.gamepassPrice}</span></p>}
                  </div>
                </div>
              </div>
            )}

            {row.gameDetail && (
              <div className="bg-sky-50/50 border border-sky-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-sky-500 uppercase tracking-wider mb-2">{c.GAME} {c.productDetails}</p>
                <div className="space-y-1">
                  <p className="text-sm"><span className="font-bold text-neutral-500">{c.userId}:</span> <span className="font-black text-neutral-900">{row.gameDetail.userId}</span></p>
                  {row.gameDetail.zoneId && <p className="text-sm"><span className="font-bold text-neutral-500">{c.zoneId}:</span> <span className="font-black text-neutral-900">{row.gameDetail.zoneId}</span></p>}
                </div>
              </div>
            )}

            <details className="text-xs font-medium text-neutral-600 cursor-pointer group">
              <summary className="outline-none font-bold hover:text-pink-600 transition list-none flex items-center gap-1">
                {t.regional.regionalMonitoring}
                <svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
              </summary>
              <div className="mt-2 bg-neutral-50 rounded-xl p-3 border border-neutral-100 space-y-1.5">
                <p><span className="text-neutral-400">{t.regional.paymentMethod}:</span> <span className="font-semibold">{row.paymentMethod || t.regional.notAvailable}</span></p>
                <p><span className="text-neutral-400">{t.regional.payerCountry}:</span> <span className="font-semibold text-neutral-400">{t.regional.payerCountryUnavailable}</span></p>
                <p><span className="text-neutral-400">{t.regional.vpnCheck}:</span> <span className="font-semibold text-neutral-400">{t.regional.vpnUnassessed}</span></p>
              </div>
            </details>
          </div>
        </div>

        {row.fulfillmentStatus !== 'COMPLETED' && row.refundStatus !== 'COMPLETED' && (
          <div className="mt-6 pt-5 border-t border-pink-100 bg-pink-50/30 -mx-6 -mb-6 p-6 rounded-b-3xl">
            <label className="block text-sm font-bold text-neutral-700 mb-2">
              {c.evidence}
              <input maxLength={1000} value={evidence[row.id] || ''} onChange={e => setEvidence(old => ({ ...old, [row.id]: e.target.value }))} className="mt-1 block w-full border-2 border-pink-100 rounded-xl px-4 py-2.5 bg-white focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-50 transition-all font-normal" placeholder="Transaction ID, screenshot URL, etc." />
            </label>
            <div className="flex flex-wrap gap-3 mt-4">
              {row.type === 'ROBLOX' && row.status === 'PAID' && row.refundStatus === 'NONE' && <>
                {!row.owned ? (
                  <button disabled={busy} onClick={() => action(row.id, 'claim')} className="bg-pink-600 hover:bg-pink-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition active:scale-95">{c.claim}</button>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(['waiting', 'resume', 'review', 'complete'] as const).filter(a => ({ waiting: ['PROCESSING'], resume: ['WAITING_CUSTOMER', 'REQUIRES_REVIEW'], review: ['PROCESSING', 'WAITING_CUSTOMER'], complete: ['PROCESSING', 'WAITING_CUSTOMER'] }[a].includes(row.fulfillmentStatus))).map(a =>
                      <button key={a} disabled={busy || (a === 'complete' && !evidence[row.id])} onClick={() => action(row.id, a)} className={`font-bold px-5 py-2.5 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-40 ${a === 'complete' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-white border-2 border-pink-200 text-pink-700 hover:bg-pink-50'}`}>{c[a]}</button>
                    )}
                  </div>
                )}
              </>}
              {row.type === 'GAME' && row.fulfillmentStatus === 'REQUIRES_REVIEW' && row.refundStatus === 'NONE' && <button disabled={busy || !evidence[row.id]} onClick={() => action(row.id, 'resolve-game')} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-40">{c.complete}</button>}
              {(row.status === 'PAID' || row.refundStatus === 'REQUIRED') && <button disabled={busy || (row.refundStatus === 'REQUIRED' && !evidence[row.id])} onClick={() => action(row.id, row.refundStatus === 'REQUIRED' ? 'refund-completed' : 'refund-required')} className={`font-bold px-5 py-2.5 rounded-xl shadow-sm transition active:scale-95 disabled:opacity-40 ${row.refundStatus === 'REQUIRED' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white border-2 border-rose-200 text-rose-700 hover:bg-rose-50'}`}>{row.refundStatus === 'REQUIRED' ? c.refundCompleted : c.refundRequired}</button>}
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-6 text-xs text-neutral-500 font-medium">
          {row.job?.evidence && <p className="break-all"><span className="font-bold">{c.evidence}:</span> {row.job.evidence}</p>}
          <details className="cursor-pointer group"><summary className="outline-none hover:text-pink-600 transition list-none flex items-center gap-1">{c.attempts}<svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto bg-neutral-50 p-2 rounded-lg">{row.job?.attempts.map(a => <p key={a.id}>{label(a.operation)} &middot; {label(a.outcome)} &middot; {new Date(a.createdAt).toLocaleString()}</p>)}</div>
          </details>
          <details className="cursor-pointer group"><summary className="outline-none hover:text-pink-600 transition list-none flex items-center gap-1">{c.audit}<svg className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></summary>
            <div className="mt-2 space-y-1 max-h-32 overflow-y-auto bg-neutral-50 p-2 rounded-lg">{row.audits.map(a => <p key={a.id}>{label(a.action)} &middot; {new Date(a.createdAt).toLocaleString()}</p>)}</div>
          </details>
        </div>
      </article>)}
    </div>

    {cursor && (
      <div className="flex justify-center mt-8">
        <button disabled={busy} onClick={more} className="bg-white border-2 border-pink-200 text-pink-700 font-bold hover:bg-pink-50 rounded-xl px-8 py-3 shadow-sm transition active:scale-95 disabled:opacity-50">
          {t.loadMore}
        </button>
      </div>
    )}
  </section>;
}
