'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import StoreShell from './StoreShell';
import AdminDialog from './AdminDialog';
import { useLanguage } from '@/context/LanguageContext';
import { parseAppsConfig, type AppsConfig } from '@/lib/appsProduct';
import AggregateMetricsAdmin from './AggregateMetricsAdmin';
import AppsReminderReview from './AppsReminderReview';

type Product = { id: number; name: string; slug: string; price: number; category: string; active: boolean; appsConfig: AppsConfig | null; updatedAt: string };
type Work = { id: number; invoice: string; productName: string; fulfillmentStatus: string; appsSnapshot: AppsConfig | null; appsSupport: { reason: string; status: string } | null; appsService: { deliveredAt: string | null; acknowledgedAt: string | null; renewalOfOrderId: number | null; reminderOptIn?: boolean; reminderVerifiedAt?: string | null } | null };
const fields = ['appGroup', 'accountType', 'durationDays', 'devices', 'regionRules', 'included', 'usageRules', 'instructions', 'warrantyDays', 'warrantyTerms'] as const;
type Draft = { id?: number; name: string; slug: string; price: string; category: string; active: boolean; updatedAt?: string; config: Record<string, string> };
const blank = (): Draft => ({ name: '', slug: '', price: '', category: 'Apps Premium', active: false, config: {} });

export default function AppsAdmin() {
  const { t } = useLanguage(); const a = t.apps;
  const [products, setProducts] = useState<Product[]>([]); const [work, setWork] = useState<Work[]>([]);
  const [productCursor, setProductCursor] = useState<number | null>(null); const [workCursor, setWorkCursor] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [reauth, setReauth] = useState(false); const [password, setPassword] = useState('');
  const [target, setTarget] = useState<{ row: Work; action: 'deliver' | 'complete' } | null>(null); const [value, setValue] = useState('');
  const [contact, setContact] = useState<{ recipientEmail?: string; recipientPhone?: string; orderId?: number; consentAt?: string; displayUntil: string } | null>(null);
  const [verification, setVerification] = useState('');
  useEffect(() => { if (!contact) return; const timer = setTimeout(() => setContact(null), Math.max(0, Date.parse(contact.displayUntil) - Date.now())); const hide = () => { if (document.hidden) setContact(null); }; document.addEventListener('visibilitychange', hide); return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hide); }; }, [contact]);
  const submitting = useRef(false);
  const load = useCallback(async (signal?: AbortSignal, kind?: 'products' | 'orders', cursor?: number) => {
    try {
      for (const resource of kind ? [kind] : ['products', 'orders'] as const) {
        const response = await fetch(`/api/admin/apps/${resource}${cursor ? '?cursor=' + cursor : ''}`, { signal }); const json = await response.json();
        if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error();
        if (signal?.aborted) return;
        if (resource === 'products') { setProducts(old => cursor ? [...old, ...json.data] : json.data); setProductCursor(json.pagination.nextCursor); }
        else { setWork(old => cursor ? [...old, ...json.data] : json.data); setWorkCursor(json.pagination.nextCursor); }
      }
    } catch { if (!signal?.aborted) setMessage(a.error); }
  }, [a.error]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all((['products', 'orders'] as const).map(async kind => {
      const response = await fetch('/api/admin/apps/' + kind, { signal: controller.signal }); const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.data)) throw new Error(); return { kind, json };
    })).then(results => {
      if (controller.signal.aborted) return;
      for (const { kind, json } of results) {
        if (kind === 'products') { setProducts(json.data); setProductCursor(json.pagination.nextCursor); }
        else { setWork(json.data); setWorkCursor(json.pagination.nextCursor); }
      }
    }).catch(() => { if (!controller.signal.aborted) setMessage(a.error); });
    return () => controller.abort();
  }, [a.error]);
  async function mutate(url: string, body: unknown): Promise<boolean> {
    if (submitting.current) return false; submitting.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const json = await response.json();
      if (json.errorCode === 'REAUTH_REQUIRED') { setReauth(true); throw new Error(); }
      if (!response.ok || !json.success) throw new Error();
      if ((json.data?.recipientEmail || json.data?.recipientPhone) && json.data?.displayUntil) { setVerification(''); setContact(json.data); }
      setMessage(a.saved); await load(); return true;
    } catch { setMessage(a.error); return false; }
    finally { submitting.current = false; setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft) return;
    try {
      const hasConfig = Object.values(draft.config).some(Boolean);
      const config = hasConfig ? parseAppsConfig({ ...draft.config, version: 1, durationDays: Number(draft.config.durationDays), warrantyDays: Number(draft.config.warrantyDays),
        activationMethod: draft.config.fulfillmentMode === 'ACTIVATION' ? draft.config.activationMethod : null }) : null;
      if (await mutate('/api/admin/apps/products', { id: draft.id, name: draft.name, slug: draft.slug, category: draft.category, price: Number(draft.price), active: draft.active, appsConfig: config, updatedAt: draft.updatedAt })) setDraft(null);
    } catch { setMessage(a.error); }
  }
  return <StoreShell wide>
    <Link href="/admin" className="mb-4 inline-block rounded-xl bg-white p-3 font-bold">← {t.commerce.home}</Link>
    <section className="space-y-5 rounded-3xl border-2 border-pink-200 bg-white p-5 sm:p-8">
      <h1 className="text-2xl font-black text-pink-900">{a.manage}</h1>
      {message && <p role="status" className="rounded-xl bg-pink-50 p-4">{message}</p>}
      <div className="flex flex-wrap gap-3"><button onClick={() => setDraft(blank())} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.newProduct}</button><button onClick={() => { setDraft({ ...blank(), name: 'CapCut Pro Private 1 bulan', slug: 'capcut-pro-private-1-bulan' }); }} className="rounded-xl border border-pink-300 p-3">CapCut Pro Private 1 bulan</button><button onClick={() => { setDraft({ ...blank(), name: 'CapCut Pro Private 7 hari', slug: 'capcut-pro-private-7-hari' }); }} className="rounded-xl border border-pink-300 p-3">CapCut Pro Private 7 hari</button></div>
      <ul className="divide-y divide-pink-100">{products.map(p => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><span>{p.name} · {p.price} IDR · {p.active ? a.active : t.commerce.unavailable}</span><button onClick={() => setDraft({ id: p.id, name: p.name, slug: p.slug, price: String(p.price), category: p.category, active: p.active, updatedAt: p.updatedAt,
        config: p.appsConfig ? Object.fromEntries(Object.entries(p.appsConfig).filter(([key]) => key !== 'version').map(([key, val]) => [key, val === null ? '' : String(val)])) : {} })} className="rounded-xl border border-pink-300 p-3 font-bold">{t.btnEdit}</button></li>)}</ul>
      {productCursor && <button disabled={busy} onClick={() => void load(undefined, 'products', productCursor)} className="rounded-xl border p-3">{t.loadMore}</button>}
      {draft && <form onSubmit={save} className="grid gap-4 rounded-2xl border-2 border-pink-200 p-4 sm:grid-cols-2">
        {(['name', 'slug', 'price', 'category'] as const).map(key => <label key={key} className="text-sm font-bold">{a[key]}<input required={key !== 'price'} type={key === 'price' ? 'number' : 'text'} min={0} max={key === 'price' ? 2147483647 : undefined} maxLength={key === 'category' ? 50 : 100} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} className="mt-1 w-full rounded-xl border border-pink-200 p-3 font-normal" /></label>)}
        {fields.map(key => <label key={key} className="text-sm font-bold">{a[key]}<textarea maxLength={['usageRules', 'instructions', 'warrantyTerms'].includes(key) ? 2000 : key === 'included' ? 1000 : 300} value={draft.config[key] || ''} onChange={e => setDraft({ ...draft, config: { ...draft.config, [key]: e.target.value } })} className="mt-1 w-full rounded-xl border border-pink-200 p-3 font-normal" /></label>)}
        <label className="text-sm font-bold">{a.fulfillmentMode}<select value={draft.config.fulfillmentMode || ''} onChange={e => setDraft({ ...draft, config: { ...draft.config, fulfillmentMode: e.target.value, activationMethod: '' } })} className="mt-1 w-full rounded-xl border p-3"><option value="">{a.select}</option>{(['READY_ACCOUNT', 'ACTIVATION'] as const).map(key => <option key={key} value={key}>{a[key]}</option>)}</select></label>
        {draft.config.fulfillmentMode === 'ACTIVATION' && <label className="text-sm font-bold">{a.activationMethod}<select required value={draft.config.activationMethod || ''} onChange={e => setDraft({ ...draft, config: { ...draft.config, activationMethod: e.target.value } })} className="mt-1 w-full rounded-xl border p-3"><option value="">{a.select}</option>{(['INVITATION', 'LINK', 'VOUCHER'] as const).map(key => <option key={key} value={key}>{a[key]}</option>)}</select></label>}
        <label className="flex gap-3 text-sm"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} />{a.active}</label>
        <div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.save}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className="rounded-xl border p-3">{a.cancel}</button></div>
      </form>}
    </section>
    <section className="mt-6 space-y-4 rounded-3xl border-2 border-pink-200 bg-white p-5 sm:p-8"><h2 className="text-2xl font-bold text-pink-900">{a.services}</h2>
      {!work.length && <p>{a.empty}</p>}
      {work.map(row => <article key={row.id} className="space-y-3 rounded-2xl border border-pink-200 p-4"><h3 className="break-words font-bold">{row.invoice} · {row.productName}</h3><p>{t.commerce[row.fulfillmentStatus as keyof typeof t.commerce] || row.fulfillmentStatus}</p>
        {row.appsSnapshot && <p className="text-sm">{a[row.appsSnapshot.fulfillmentMode]}{row.appsSnapshot.activationMethod ? ` · ${a[row.appsSnapshot.activationMethod]}` : ''}</p>}
        {row.appsService && row.fulfillmentStatus !== 'COMPLETED' && <div className="flex flex-wrap gap-3"><button disabled={busy} onClick={() => void mutate('/api/admin/apps/orders', { orderId: row.id, action: 'claim' })} className="rounded-xl border p-3">{a.claim}</button>{(['deliver', 'complete'] as const).map(action => <button key={action} disabled={busy} onClick={() => { setValue(''); setTarget({ row, action }); }} className="rounded-xl border p-3">{a[action]}</button>)}</div>}
        {row.appsService && row.fulfillmentStatus !== 'COMPLETED' && <button disabled={busy} onClick={() => void mutate('/api/admin/apps/orders', { orderId: row.id, action: 'contact' })} className="rounded-xl border p-3">{a.contact}</button>}
        {row.appsService?.reminderOptIn && !row.appsService.reminderVerifiedAt && <button disabled={busy} onClick={() => void mutate('/api/admin/apps/orders', { orderId: row.id, action: 'reminder-contact' })} className="rounded-xl border p-3">{a.reminderVerify}</button>}
        {row.appsSupport && <div className="space-y-3"><p>{a.support}: {a[row.appsSupport.status as keyof typeof a] || row.appsSupport.status} · {a[row.appsSupport.reason as keyof typeof a] || row.appsSupport.reason}</p><div className="flex flex-wrap gap-2">{(['IN_PROGRESS', 'RESOLVED', 'REJECTED'] as const).filter(status => row.appsSupport?.status === 'OPEN' ? status !== 'RESOLVED' : row.appsSupport?.status === 'IN_PROGRESS' ? status !== 'IN_PROGRESS' : false).map(status => <button key={status} disabled={busy} onClick={() => void mutate('/api/admin/apps/orders', { orderId: row.id, action: 'support-status', supportStatus: status })} className="rounded-xl border p-3">{a[status]}</button>)}</div></div>}
      </article>)}
      {workCursor && <button disabled={busy} onClick={() => void load(undefined, 'orders', workCursor)} className="rounded-xl border p-3">{t.loadMore}</button>}
    </section>
    {target && <AdminDialog title={a[target.action]} busy={busy} onClose={() => setTarget(null)}><form onSubmit={async e => { e.preventDefault(); if (await mutate('/api/admin/apps/orders', { orderId: target.row.id, action: target.action, [target.action === 'deliver' ? 'delivery' : 'evidence']: value })) { setValue(''); setTarget(null); } }} className="space-y-4"><label className="block text-sm font-bold">{target.action === 'deliver' ? a.delivery : a.evidence}<textarea required maxLength={target.action === 'deliver' ? 2000 : 191} value={value} onChange={e => setValue(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><p className="text-sm">{a.noSecrets}</p><button disabled={busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.save}</button><button type="button" disabled={busy} onClick={() => { setTarget(null); setValue(''); }} className="ml-3 rounded-xl border p-3">{a.cancel}</button></form></AdminDialog>}
    {reauth && <AdminDialog title={a.reauth} busy={busy} onClose={() => { setReauth(false); setPassword(''); }}><form onSubmit={async e => { e.preventDefault(); if (await mutate('/api/admin/reauth', { password })) { setPassword(''); setReauth(false); } }}><label className="block">{a.password}<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="my-3 w-full rounded-xl border p-3" /></label><button disabled={busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.reauth}</button></form></AdminDialog>}
    {contact && <AdminDialog title={contact.recipientPhone ? a.reminderVerify : a.contact} busy={busy} onClose={() => setContact(null)}><p className="break-all">{contact.recipientEmail || contact.recipientPhone}</p>
      {contact.recipientPhone && <form className="mt-3 space-y-3" onSubmit={async e => { e.preventDefault(); if (await mutate('/api/admin/apps/orders', { orderId: contact.orderId, action: 'reminder-verify', consentAt: contact.consentAt, evidence: verification })) { setContact(null); setVerification(''); } }}><p className="text-sm leading-6">{a.reminderVerifyHelp}</p><label className="block text-sm font-bold">{a.evidence}<input required maxLength={100} pattern="[A-Za-z0-9:_-]+" value={verification} onChange={e => setVerification(e.target.value)} className="mt-1 w-full rounded-xl border p-3" /></label><button disabled={busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.reminderVerify}</button></form>}
      <button onClick={() => setContact(null)} className="mt-4 rounded-xl border p-3">{a.close}</button></AdminDialog>}
    <AggregateMetricsAdmin />
    <AppsReminderReview onReauth={() => setReauth(true)} />
  </StoreShell>;
}
