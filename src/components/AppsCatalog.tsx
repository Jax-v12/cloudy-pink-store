'use client';
import { observeCheckout } from './AggregateMetrics';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import StoreShell from './StoreShell';
import { useLanguage } from '@/context/LanguageContext';
import { parseCatalogResponse, type AppsProduct } from '@/lib/appsProduct';
import { formatMoney } from '@/lib/regionalPricing';

export function AppsPackageDetails({ product }: { product: AppsProduct }) {
  const { t } = useLanguage(); const a = t.apps; const config = product.appsConfig;
  if (!config) return <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{a.legacy}</p>;
  return <dl className="grid gap-4 text-sm sm:grid-cols-2">
    {(['accountType', 'durationDays', 'devices', 'regionRules', 'included', 'usageRules', 'instructions', 'warrantyDays', 'warrantyTerms'] as const).map(key => <div key={key} className="min-w-0 rounded-xl bg-pink-50 p-4">
      <dt className="font-bold text-pink-900">{a[key]}</dt><dd className="mt-1 whitespace-pre-wrap break-words leading-6 text-slate-800">{config[key]}</dd>
    </div>)}
    <div><dt className="font-bold">{a.fulfillmentMode}</dt><dd>{a[config.fulfillmentMode]}{config.activationMethod ? ` · ${a[config.activationMethod]}` : ''}</dd></div>
  </dl>;
}

export default function AppsCatalog({ slug }: { slug?: string }) {
  const { t, language } = useLanguage(); const a = t.apps; const router = useRouter();
  const [products, setProducts] = useState<AppsProduct[]>([]); const [cursor, setCursor] = useState<number | null>(null);
  const [query, setQuery] = useState(''); const [category, setCategory] = useState(''); const [filters, setFilters] = useState('');
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [email, setEmail] = useState(''); const [agree, setAgree] = useState(false); const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState(''); const activeRequest = useRef<AbortController | null>(null);
  const submitting = useRef(false); const checkoutKey = useRef({ body: '', key: '' });
  const requestId = useRef(0);
  const load = useCallback(async (next: number | null = null) => {
    activeRequest.current?.abort(); const controller = new AbortController(); activeRequest.current = controller;
    const id = ++requestId.current; setLoading(true); setError('');
    if (!next) { setCursor(null); setProducts([]); setAgree(false); }
    const params = new URLSearchParams(filters); if (slug) params.set('slug', slug); if (next) params.set('cursor', String(next));
    try {
      const page = await parseCatalogResponse(await fetch('/api/products?' + params, { signal: controller.signal }));
      if (id === requestId.current && !controller.signal.aborted) { setProducts(old => next ? [...old, ...page.data.filter(p => !old.some(o => o.id === p.id))] : page.data); setCursor(page.nextCursor); }
    } catch { if (!controller.signal.aborted && id === requestId.current) setError(t.errSystem); }
    finally { if (!controller.signal.aborted && id === requestId.current) setLoading(false); }
  }, [filters, slug, t.errSystem]);
  useEffect(() => {
    activeRequest.current?.abort(); const controller = new AbortController(); activeRequest.current = controller;
    const id = ++requestId.current; const params = new URLSearchParams(filters); if (slug) params.set('slug', slug);
    fetch('/api/products?' + params, { signal: controller.signal }).then(parseCatalogResponse).then(page => {
      if (!controller.signal.aborted && id === requestId.current) { setProducts(page.data); setCursor(page.nextCursor); setError(''); setAgree(false); }
    }).catch(() => { if (!controller.signal.aborted && id === requestId.current) setError(t.errSystem); })
      .finally(() => { if (!controller.signal.aborted && id === requestId.current) setLoading(false); });
    return () => controller.abort();
  }, [filters, slug, revision, t.errSystem]);
  const product = slug ? products.find(p => p.slug === slug) : null;
  const ready = (p: AppsProduct) => p.checkoutEnabled && (p.appsConfig?.fulfillmentMode === 'ACTIVATION' || p.stockAvailable > 0);
  const money = (n: number) => formatMoney(n, 'IDR', language);
  async function checkout(event: React.FormEvent) {
    event.preventDefault(); if (!product || !ready(product) || !agree || submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    observeCheckout();
    const body = JSON.stringify({ productId: product.id, customerEmail: email, ...(product.appsPolicyToken ? { appsPolicyToken: product.appsPolicyToken } : {}) });
    if (checkoutKey.current.body !== body) checkoutKey.current = { body, key: crypto.randomUUID() };
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': checkoutKey.current.key }, body });
      const json = await response.json();
      if (!response.ok || !json.success) {
        if (json.errorCode === 'APPS_TERMS_CHANGED') { await load(); throw new Error(a.changed); }
        throw new Error(t.errSystem);
      }
      if (!json.data?.invoice || !json.data?.accessToken) throw new Error(t.errSystem);
      // Preserve the existing invoice access mechanism; never persist account credentials.
      localStorage.setItem(`token_${json.data.invoice}`, json.data.accessToken);
      router.push(`/order/${encodeURIComponent(json.data.invoice)}`);
    } catch (e) { setError(e instanceof Error ? e.message : t.errSystem); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <StoreShell>
    {!slug && <div className="mx-auto mb-6 max-w-xl overflow-hidden rounded-3xl border-4 border-pink-200 bg-white"><Image src="/banner-logo.png" alt="Cloudy Pink Store" width={1774} height={887} sizes="(max-width: 640px) 100vw, 576px" className="h-auto w-full" /></div>}
    <section className="rounded-3xl border-2 border-pink-200 bg-white p-5 shadow-xl sm:p-8">
      <h1 className="text-2xl font-black text-pink-900 sm:text-3xl">{product?.name || t.catalogTitle}</h1>
      {!slug && <>
        <p className="mt-2 text-sm leading-6 text-slate-700">{t.catalogSubtitle}</p>
        <form className="my-6 grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); activeRequest.current?.abort(); setLoading(true); setError(''); setProducts([]); setCursor(null); setFilters(new URLSearchParams({ q: query.trim(), category: category.trim() }).toString()); setRevision(n => n + 1); }}>
          <label className="text-sm font-bold">{t.searchPlaceholder}<input type="search" maxLength={100} value={query} onChange={e => setQuery(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-pink-200 p-3 font-normal" /></label>
          <label className="text-sm font-bold">{a.category}<input maxLength={50} value={category} onChange={e => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border-2 border-pink-200 p-3 font-normal" /></label>
          <button className="rounded-xl bg-pink-700 px-5 py-3 font-bold text-white">{t.searchButton}</button>
        </form>
      </>}
      {slug && <Link href="/apps" className="my-4 inline-block rounded-xl border border-pink-200 px-4 py-3 font-bold text-pink-900">← {a.back}</Link>}
      {error && <div role="alert" className="my-4 rounded-xl bg-rose-50 p-4 text-rose-900"><p>{error}</p><button type="button" disabled={busy || loading} onClick={() => void load(cursor && products.length ? cursor : null)} className="mt-3 rounded-lg border border-rose-300 px-4 py-2 font-bold">{a.retry}</button></div>}
      {loading && <p role="status" className="min-h-24 py-6">{t.loadingCatalog}</p>}
      {!loading && !error && !products.length && <p role="status" className="py-8">{filters ? t.searchEmpty : t.emptyCatalog}</p>}
      {!slug && <div className="grid gap-4 min-[360px]:grid-cols-2 md:grid-cols-3">{products.map(p => <article key={p.id} className="flex min-w-0 flex-col rounded-2xl border-2 border-pink-100 p-4">
        <p className="text-xs font-bold text-slate-600">{p.appsConfig?.appGroup || p.category}</p>
        <h2 className="mt-2 break-words text-base font-black leading-6 text-pink-900">{p.name}</h2>
        <p className="mt-3 text-lg font-black text-pink-800">{money(p.price)}</p>
        <p className="my-3 text-sm text-slate-700">{p.appsConfig ? a.days.replace('{days}', String(p.appsConfig.durationDays)) : a.details}</p>
        <p className="text-sm font-semibold">{ready(p) ? p.appsConfig?.fulfillmentMode === 'ACTIVATION' ? a.ACTIVATION : `${t.stockRemaining} ${p.stockAvailable}` : t.stockOut}</p>
        <Link href={`/apps/${encodeURIComponent(p.slug)}`} className="mt-4 block rounded-xl bg-pink-700 px-3 py-3 text-center text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-4">{a.details}</Link>
      </article>)}</div>}
      {!slug && cursor && <button type="button" disabled={loading} onClick={() => void load(cursor)} className="mt-5 rounded-xl border-2 border-pink-200 px-5 py-3 font-bold">{t.loadMore}</button>}
      {product && <div className="space-y-6">
        <AppsPackageDetails product={product} />
        <form onSubmit={checkout} className="space-y-4 rounded-2xl border-2 border-pink-200 p-5">
          <p className="text-xl font-black text-pink-900">{t.modalTotal}: {money(product.price)}</p>
          <p className="text-sm">{ready(product) ? product.appsConfig?.fulfillmentMode === 'ACTIVATION' ? a.ACTIVATION : `${t.stockRemaining} ${product.stockAvailable}` : t.stockOut}</p>
          <label className="block text-sm font-bold">{a.email}<input type="email" autoComplete="email" required maxLength={150} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} className="mt-1 w-full rounded-xl border-2 border-pink-200 p-3" /></label>
          <p className="text-sm leading-6 text-slate-700">{a.emailHint}</p>
          <label className="flex gap-3 text-sm leading-6"><input type="checkbox" required checked={agree} onChange={e => setAgree(e.target.checked)} disabled={busy} className="mt-1 h-5 w-5 shrink-0" />{a.agree}</label>
          <button disabled={busy || !agree || !ready(product)} className="w-full rounded-xl bg-pink-700 p-3 font-bold text-white disabled:opacity-50">{busy ? a.processing : t.btnPayNow}</button>
        </form>
      </div>}
    </section>
    {!slug && <form className="mt-5 rounded-2xl border border-pink-200 bg-white p-5" onSubmit={event => { event.preventDefault(); if (invoice.trim()) router.push('/order/' + encodeURIComponent(invoice.trim())); }}>
      <label className="block text-sm font-bold">{t.trackTitle}<input value={invoice} onChange={e => setInvoice(e.target.value)} maxLength={191} className="mt-2 w-full rounded-xl border border-pink-200 p-3" /></label>
      <button className="mt-3 rounded-xl border border-pink-300 px-5 py-3 font-bold">{t.trackButton}</button>
    </form>}
  </StoreShell>;
}
