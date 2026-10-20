'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { appsDeliveryVisible, type AppsConfig, type AppsProduct } from '@/lib/appsProduct';
import { formatMoney } from '@/lib/regionalPricing';
import { AppsPackageDetails } from './AppsCatalog';
import AdminDialog from './AdminDialog';
import AppsReminderPanel, { type ReminderState } from './AppsReminderPanel';

export type AppsOrder = { invoice: string; status: string; refundStatus: string; fulfillmentStatus: string;
  appsSnapshot?: AppsConfig | null; appsWarranty?: { expiresAt: string | null; active: boolean; legacy: boolean; days: number };
  appsSupport?: { reason: string; status: string } | null;
  appsService?: ({ deliveredAt: string | null; acknowledgedAt: string | null; activeFrom: string | null; activeUntil: string | null; delivery: string | null } & ReminderState) | null };

export default function AppsOrderPanel({ order, refresh, now }: { order: AppsOrder; refresh: () => void; now: number }) {
  const { t, language } = useLanguage(); const a = t.apps; const router = useRouter();
  const [reason, setReason] = useState('DELIVERY_HELP'); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [renewal, setRenewal] = useState<AppsProduct | null>(null); const [agree, setAgree] = useState(false);
  const lock = useRef(false); const renewalKey = useRef('');
  const headers = () => ({ 'Content-Type': 'application/json', 'x-order-token': localStorage.getItem(`token_${order.invoice}`) || '' });
  async function action(body: Record<string, string>) {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.invoice)}/apps`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
      if (!response.ok || !(await response.json()).success) throw new Error(); refresh();
    } catch { setError(a.error); }
    finally { lock.current = false; setBusy(false); }
  }
  async function getRenewal() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.invoice)}/renew`, { headers: headers() }); const json = await response.json();
      if (!response.ok || !json.success) throw new Error(); setRenewal(json.data); setAgree(false); renewalKey.current = crypto.randomUUID();
    } catch { setError(a.error); } finally { setBusy(false); }
  }
  async function confirmRenewal(event: React.FormEvent) {
    event.preventDefault(); if (!renewal || !agree || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.invoice)}/renew`, { method: 'POST', headers: { ...headers(), 'idempotency-key': renewalKey.current }, body: JSON.stringify({ appsPolicyToken: renewal.appsPolicyToken }) });
      const json = await response.json(); if (!response.ok || !json.success) { if (json.errorCode === 'APPS_TERMS_CHANGED') { setAgree(false); setRenewal(null); } throw new Error(); }
      localStorage.setItem(`token_${json.data.invoice}`, json.data.accessToken); router.push(`/order/${encodeURIComponent(json.data.invoice)}`);
    } catch { setError(a.error); } finally { lock.current = false; setBusy(false); }
  }
  const date = (value: string) => new Date(value).toLocaleString(language === 'ID' ? 'id-ID' : language === 'MY' ? 'ms-MY' : 'en-GB');
  return <section className="my-6 space-y-4 rounded-2xl border-2 border-pink-200 bg-white p-5">
    <h2 className="text-lg font-bold text-pink-900">{a.policy}</h2>
    {order.appsSnapshot ? <><p className="whitespace-pre-wrap text-sm leading-6">{order.appsSnapshot.warrantyTerms}</p><p>{a.warrantyDays}: {order.appsSnapshot.warrantyDays}</p></> : <p className="text-sm">{a.warrantyLegacy}</p>}
    <p className="text-sm">{order.appsWarranty?.expiresAt ? `${a.warrantyUntil}: ${date(order.appsWarranty.expiresAt)}` : a.warrantyUnknown}</p>
    {order.appsSnapshot && <div className="space-y-2 text-sm leading-6"><h3 className="font-bold">{a.instructions}</h3><p className="whitespace-pre-wrap">{order.appsSnapshot.instructions}</p><p>{a[order.appsSnapshot.fulfillmentMode]}{order.appsSnapshot.activationMethod ? ` · ${a[order.appsSnapshot.activationMethod]}` : ''}</p></div>}
    {order.appsService?.delivery && appsDeliveryVisible(order.appsService.deliveredAt, now) && <pre className="whitespace-pre-wrap break-all rounded-xl bg-pink-50 p-4 font-sans text-sm">{order.appsService.delivery}</pre>}
    {order.appsSnapshot?.fulfillmentMode === 'ACTIVATION' && <p className="text-sm leading-6 text-slate-700">{a.deliveryLifetime}</p>}
    {order.appsService?.activeFrom && <p className="text-sm">{a.activeFrom}: {date(order.appsService.activeFrom)}</p>}
    {order.appsService?.activeUntil && <p className="text-sm">{a.activeUntil}: {date(order.appsService.activeUntil)}</p>}
    {order.status === 'PAID' && order.refundStatus === 'NONE' && <>
      {order.fulfillmentStatus === 'WAITING_CUSTOMER' && order.appsService?.deliveredAt && (order.appsService.acknowledgedAt ? <p className="text-sm">{a.acknowledged}</p> : <button disabled={busy} onClick={() => void action({ action: 'acknowledge' })} className="rounded-xl border border-pink-300 p-3 font-bold">{a.acknowledge}</button>)}
      <h3 className="font-bold">{a.support}</h3><p className="text-sm">{a.noSecrets}</p>
      {order.appsSupport && <p role="status">{a[order.appsSupport.status as keyof typeof a] || order.appsSupport.status}</p>}
      {(!order.appsSupport || ['RESOLVED', 'REJECTED'].includes(order.appsSupport.status)) && <form onSubmit={e => { e.preventDefault(); void action({ action: 'support', reason }); }} className="space-y-3"><label className="block text-sm font-bold">{a.reason}<select value={reason} onChange={e => setReason(e.target.value)} className="mt-1 w-full rounded-xl border border-pink-200 p-3">{(['DELIVERY_HELP', 'NO_ACCESS', 'STOPPED_WORKING'] as const).filter(key => key === 'DELIVERY_HELP' || order.appsWarranty?.active).map(key => <option key={key} value={key}>{a[key]}</option>)}</select></label><button disabled={busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white">{a.request}</button></form>}
      {order.appsService?.activeFrom && order.appsSnapshot?.fulfillmentMode === 'ACTIVATION' && <button disabled={busy} onClick={() => void getRenewal()} className="rounded-xl border-2 border-pink-300 p-3 font-bold">{a.renew}</button>}
      {order.fulfillmentStatus === 'COMPLETED' && order.appsService?.activeUntil && Date.parse(order.appsService.activeUntil) > now && <AppsReminderPanel invoice={order.invoice} service={order.appsService} refresh={refresh} />}
    </>}
    {error && <p role="alert" className="text-rose-800">{error}</p>}
    {renewal && <AdminDialog title={a.renew} busy={busy} onClose={() => setRenewal(null)}><form onSubmit={confirmRenewal} className="space-y-4"><p className="text-sm">{a.renewConfirm}</p><p className="font-bold">{renewal.name} · {formatMoney(renewal.price, 'IDR', language)}</p><AppsPackageDetails product={renewal} /><label className="flex gap-3 text-sm"><input type="checkbox" required checked={agree} onChange={e => setAgree(e.target.checked)} />{a.agree}</label><button disabled={!agree || busy} className="rounded-xl bg-pink-700 p-3 font-bold text-white disabled:opacity-50">{t.btnPayNow}</button><button type="button" disabled={busy} onClick={() => setRenewal(null)} className="ml-3 rounded-xl border p-3">{a.cancel}</button>{error && <p role="alert">{error}</p>}</form></AdminDialog>}
  </section>;
}
