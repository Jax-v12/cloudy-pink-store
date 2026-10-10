'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from './StoreShell';
import DetectedLocation from './DetectedLocation';
import RegionalPaymentSummary from './RegionalPaymentSummary';
import { useRegionalQuote } from './useRegionalQuote';
import { formatMoney, regionalAmount, REGION_CURRENCY, type Region, type RegionalPrice } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';
import GamepassCheckout from './GamepassCheckout';
import RobloxCheckoutWizard from './RobloxCheckoutWizard';
import RobloxServiceCards from './RobloxServiceCards';
import RobloxMethodSelector from './RobloxMethodSelector';
import RobloxFields from './RobloxFields';
import RobloxInstructions from './RobloxInstructions';
import { isRobloxMethod, robloxGamepassPrice, type RobloxMethodKey } from '@/lib/roblox';

type Variant = { regionalPrices?: RegionalPrice[]; id: number; name: string; price: number; units: number; maxUnits: number | null; unitStep: number; method: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN' | null; gamepassPrice: number | null; requiresZone: boolean };
type Product = { id: number; name: string; slug: string; variants: Variant[]; checkoutEnabled: boolean };
export default function TopupCatalog({ type, slug, initialMethod = 'GAMEPASS' }: { type: 'GAME' | 'ROBLOX'; slug?: string; initialMethod?: RobloxMethodKey }) {
  const { t, language } = useLanguage(); const c = t.commerce; const r = t.roblox;
  const router = useRouter();
  const [refresh, setRefresh] = useState(0);
  const refreshLocation = () => setRefresh(n => n + 1);
  const [region, setRegion] = useState<Region | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId, setMethodId] = useState('');
  const selectedPayment = methods.find(m => m.id === methodId) ?? methods[0];
  const submitting = useRef(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [variantId, setVariantId] = useState(''); const [method, setMethod] = useState<RobloxMethodKey>(initialMethod);
  const [busy, setBusy] = useState(false);
  const key = useRef({ payload: '', value: '' });
  const product = slug ? products[0] : undefined;
  const variant = product?.variants.find(v => String(v.id) === variantId);
  const server = useRegionalQuote(type === 'ROBLOX' && method === 'LOGIN' ? product?.id : undefined, variant?.id, region, selectedPayment?.id ?? '');
  const path = type === 'GAME' ? '/games' : '/roblox';
  const money = (n: number) => formatMoney(n, REGION_CURRENCY[region ?? 'ID'], language);
  const variantPrice = (v: Variant) => { const amount = type === 'ROBLOX' ? region ? regionalAmount(v, region) : null : v.price; return amount === null ? t.regional.unavailable : money(amount); };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products?type=${type}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(j => { if (!controller.signal.aborted) { setProducts(j.data); setMethods(j.paymentMethods); setRegion(j.location.region); setCursor(j.pagination.nextCursor); } })
      .catch(() => { if (!controller.signal.aborted) setError('load'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); key.current = { payload: '', value: '' }; };
  }, [type, slug, refresh]);
  async function more() {
    setLoading(true);
    try {
      const r = await fetch(`/api/products?type=${type}&cursor=${cursor}`); if (!r.ok) throw new Error(); const j = await r.json();
      if (type === 'ROBLOX' && j.location.region !== region) {
        setProducts([]); setRegion(null); setMethods([]); setCursor(null); refreshLocation();
      } else { setProducts(p => [...p, ...j.data]); setCursor(j.pagination.nextCursor); }
    }
    catch { setError('load'); } finally { setLoading(false); }
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!product || !variant || busy || submitting.current || (type === 'ROBLOX' && !server.quote)) return;
    const form = event.currentTarget; const fd = new FormData(form);
    const details: Record<string, unknown> = type === 'GAME' ? { userId: fd.get('userId'), ...(variant.requiresZone ? { zoneId: fd.get('zoneId') } : {}) }
      : { username: fd.get('username'), ...(variant.method === 'GAMEPASS' ? { gamepassUrl: fd.get('gamepassUrl') } : {}) };
    const payload = JSON.stringify({ ...(type === 'ROBLOX' ? { paymentMethod: selectedPayment?.id, quoteToken: server.quote?.quoteToken } : {}), productId: product.id, variantId: variant.id, customerEmail: fd.get('email'), details });
    if (key.current.payload !== payload) key.current = { payload, value: crypto.randomUUID() };
    submitting.current = true; setBusy(true); setError('');
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': key.current.value }, body: payload });
      const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.errorCode);
      localStorage.setItem(`token_${j.data.invoice}`, j.data.accessToken);
      form.reset(); key.current = { payload: '', value: '' };
      router.push(`/order/${encodeURIComponent(j.data.invoice)}`);
    } catch (e) { const code = e instanceof Error ? e.message : 'SYSTEM_ERROR'; setError(code); if (['PRICE_CHANGED', 'REGION_UNVERIFIED', 'PAYMENT_REGION_UNAVAILABLE'].includes(code)) { server.retry(); refreshLocation(); } }
    finally { submitting.current = false; setBusy(false); }
  }
  const errors: Record<string, string> = { REGION_UNVERIFIED: t.regional.locationUnavailable, REGION_CHANGED: t.regional.priceChanged, PRICE_CHANGED: t.regional.priceChanged, REGIONAL_PRICE_UNAVAILABLE: t.regional.unavailable, PAYMENT_REGION_UNAVAILABLE: t.regional.paymentUnavailable, PAYMENT_METHOD_UNAVAILABLE: t.regional.paymentUnavailable,
    IDEMPOTENCY_CONFLICT: c.conflict, PRODUCT_UNAVAILABLE: c.checkoutUnavailable, CAPACITY_REVIEW_REQUIRED: c.checkoutUnavailable,
    INVALID_INPUT: t.errIncompleteData, ROBLOX_USER_NOT_FOUND: r.userMissing, GAMEPASS_NOT_FOUND: r.gamepassMissing,
    GAMEPASS_OWNER_MISMATCH: r.ownerMismatch, GAMEPASS_NOT_FOR_SALE: r.notForSale, GAMEPASS_PRICE_MISMATCH: r.wrongPrice,
    RATE_LIMITED: t.rateLimited, RATE_LIMIT_EXCEEDED: t.rateLimited,
  };
  const available = product?.variants.filter(v => type === 'GAME' || v.method === method) ?? [];
  function changeMethod(value: RobloxMethodKey) { setMethod(value); setVariantId(''); setError(''); key.current = { payload: '', value: '' }; }
  return <StoreShell>
    {!slug && (
      <div className="mb-6 sm:mb-10 text-center bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-pink-200 mx-auto max-w-3xl">
        <p className="mb-2 text-xs sm:text-sm font-bold text-pink-500 tracking-wider uppercase">{type === 'GAME' ? c.gameHeroEyebrow : c.robloxHeroEyebrow}</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-pink-800 mb-3">{type === 'GAME' ? c.gameHeroTitle : c.robloxHeroTitle}</h1>
        <p className="text-sm sm:text-base text-neutral-600 font-medium">{type === 'GAME' ? c.gameDescription : t.robloxFlow.intro}</p>
      </div>
    )}
    {slug && (
      <div className="mb-8">
        <Link href={`/${type.toLowerCase() === 'game' ? 'games' : 'roblox'}`} className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 hover:text-pink-700 mb-6 transition">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {c.backToCatalog}
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black text-pink-800 mb-3">{product?.name}</h1>
        {type === 'ROBLOX' && <p className="text-neutral-600 max-w-2xl mb-8">{t.robloxFlow.choose}</p>}
      </div>
    )}
    {type === 'ROBLOX' && <DetectedLocation region={region} loading={loading} />}
    {type === 'ROBLOX' && slug && <div className="mb-6 max-w-3xl"><h2 className="font-bold mb-3">{r.chooseMethod}</h2><RobloxMethodSelector id="roblox-method" value={method} onChange={changeMethod} disabled={busy} /></div>}
    {error && <p role="alert" className="bg-rose-100 text-rose-800 p-4 rounded-xl mb-4">{errors[error] || t.errSystem}</p>}
    <div {...(type === 'ROBLOX' && slug ? { role: 'tabpanel', id: 'roblox-method-panel', 'aria-labelledby': 'roblox-method-' + method, tabIndex: 0 } : {})}>
      {loading && <p role="status">{t.loadingCatalog}</p>}
      {!loading && products.length === 0 && <p className="p-8 bg-white rounded-2xl">{t.emptyCatalog}</p>}
      {!slug && type === 'ROBLOX' && !loading && products.length > 0 && <RobloxServiceCards products={products} region={region} />}
      {!slug && type === 'GAME' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">{products.map(p => {
        const choices = p.variants.filter(v => type === 'GAME' || v.method === method);
        const minPrice = choices.length ? Math.min(...choices.map(v => v.price)) : null;
        return <Link key={p.id} href={path + '/' + p.slug} className="group flex flex-col justify-between bg-white/95 backdrop-blur-md border-2 border-pink-200 rounded-3xl p-6 sm:p-7 hover:shadow-xl hover:shadow-pink-900/20 hover:border-pink-300 hover:-translate-y-1 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-400 flex items-center justify-center text-white shadow-sm shadow-pink-200">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              {!p.checkoutEnabled && <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-500">{c.unavailable}</span>}
              {p.checkoutEnabled && minPrice !== null && <span className="rounded-full bg-pink-100 px-3 py-1 text-xs font-bold text-pink-700">{c.packagesCount.replace('{count}', String(choices.length))}</span>}
            </div>
            <h2 className="text-xl font-black text-neutral-800 mb-2 group-hover:text-pink-600 transition-colors">{p.name}</h2>
            <div className="text-sm font-medium text-neutral-500">
              {minPrice !== null ? <>{c.startingFrom} <span className="text-lg font-black text-pink-600 ml-1">{money(minPrice)}</span></> : r.noPackages}
            </div>
          </div>
        </Link>;
      })}</div>}
      {!slug && cursor && <button onClick={more} disabled={loading} className="my-6 p-3 rounded-xl bg-white border border-pink-200">{t.loadMore}</button>}
      {product && region && type === 'ROBLOX' && method === 'GAMEPASS' && <GamepassCheckout key={product.id} productId={product.id} variants={available} region={region} methods={methods} enabled={product.checkoutEnabled} onRegionRefresh={refreshLocation} onBusyChange={setBusy} />}
      {product && region && type === 'ROBLOX' && method === 'GIFT_USERNAME' && <RobloxCheckoutWizard key={product.id + '-username'} method="GIFT_USERNAME" productId={product.id} variants={available} region={region} methods={methods} enabled={product.checkoutEnabled} onRegionRefresh={refreshLocation} onBusyChange={setBusy} />}
      {product && (type !== 'ROBLOX' || (region && method === 'LOGIN')) && <form onSubmit={checkout} className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <fieldset disabled={busy} className="min-w-0 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-pink-200 shadow-xl shadow-pink-900/10 p-6 sm:p-8 space-y-8">
          <div>
            <h2 className="flex items-center gap-2 font-black text-xl text-neutral-800 mb-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-sm text-pink-700">1</span>
              {type === 'ROBLOX' ? r.choosePackage : c.package}
            </h2>
            {available.length === 0 && <p role="status" className="text-neutral-500">{r.noPackages}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{available.map(v => <label key={v.id} className={'relative cursor-pointer rounded-2xl border p-4 transition-all has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pink-700 ' + (variantId === String(v.id) ? 'border-pink-500 bg-pink-50 ring-1 ring-pink-500 shadow-md shadow-pink-100' : 'border-pink-200 hover:border-pink-400 hover:bg-pink-50/50 hover:shadow-sm')}>
              <input type="radio" className="sr-only" name="package" required value={v.id} checked={variantId === String(v.id)} onChange={() => { setVariantId(String(v.id)); setError(''); }} />
              <span className="block font-bold break-words text-neutral-800">{v.name}</span>
              <span className="block text-sm mt-1 font-black text-pink-600">{variantPrice(v)}</span>
            </label>)}</div>
          </div>
          {variant && (
            <div className="animate-in fade-in slide-in-from-top-4 duration-300">
              <h2 className="flex items-center gap-2 font-black text-xl text-neutral-800 mb-4 pt-6 border-t border-pink-100">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-sm text-pink-700">2</span>
                {type === 'ROBLOX' ? r.accountDetails : c.userId}
              </h2>
              <div className="space-y-4">
                {type === 'ROBLOX' && isRobloxMethod(variant.method) ? <RobloxFields key={method} method={variant.method} units={variant.units} /> : <>
                  <label className="block">
                    <span className="block font-bold text-sm text-neutral-700 mb-1.5">{c.userId}</span>
                    <input className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-4 py-3 text-neutral-800 focus:outline-none focus:border-pink-500 transition-colors" name="userId" maxLength={64} pattern="[A-Za-z0-9_\-]+" required />
                    <span className="block text-xs text-neutral-500 mt-1.5">{c.userIdHint}</span>
                  </label>
                  {variant.requiresZone && <label className="block">
                    <span className="block font-bold text-sm text-neutral-700 mb-1.5">{c.zoneId}</span>
                    <input className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-4 py-3 text-neutral-800 focus:outline-none focus:border-pink-500 transition-colors" name="zoneId" maxLength={32} required />
                  </label>}
                </>}
                <label className="block">
                  <span className="block font-bold text-sm text-neutral-700 mb-1.5">{c.email}</span>
                  <input className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-4 py-3 text-neutral-800 focus:outline-none focus:border-pink-500 transition-colors" type="email" name="email" maxLength={150} autoComplete="email" required />
                  <span className="block text-xs text-neutral-500 mt-1.5">{c.emailHint}</span>
                </label>
              </div>
            </div>
          )}
        </fieldset>
        <aside className="bg-white/95 backdrop-blur-md border-2 border-pink-200 shadow-xl shadow-pink-900/10 rounded-3xl p-6 sm:p-7 space-y-6 lg:sticky lg:top-8">
          <h2 className="text-xl font-black text-pink-900 border-b border-pink-100 pb-4">{r.summary}</h2>
          {type === 'ROBLOX' && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-500">{c.method}</span>
              <strong className="px-3 py-1 bg-pink-50 text-pink-700 rounded-full">{r[method]}</strong>
            </div>
          )}
          {variant ? <>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-3 text-neutral-600"><dt>{c.package}</dt><dd className="font-bold text-neutral-800 text-right">{variant.name}</dd></div>
              <div className="flex justify-between gap-3 text-neutral-600"><dt>{type === 'ROBLOX' ? r.netRobux : c.units}</dt><dd className="font-bold text-neutral-800">{variant.units}</dd></div>
              {variant.method === 'GAMEPASS' && <div className="flex justify-between gap-3 text-neutral-600"><dt>{r.priceToSet}</dt><dd className="font-bold text-neutral-800 whitespace-nowrap">{robloxGamepassPrice(variant.units)} Robux</dd></div>}
              <div className="border-t border-pink-100 pt-5 mt-2">
                <dt className="text-neutral-500 font-semibold mb-1">{type === 'ROBLOX' ? t.regional.subtotal : r.total}</dt>
                <dd className="text-3xl font-black text-pink-600 drop-shadow-sm">{server.quote ? money(server.quote.productSubtotal) : variantPrice(variant)}</dd>
              </div>
            </dl>
            {type === 'ROBLOX' && isRobloxMethod(variant.method) && <RobloxInstructions method={variant.method} gamepassPrice={variant.method === 'GAMEPASS' ? robloxGamepassPrice(variant.units) : null} />}
          </> : (
            <div className="bg-pink-50/50 border border-pink-100 border-dashed rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-pink-400">{type === 'ROBLOX' ? r.choosePackage : c.package}</p>
            </div>
          )}
          {type === 'ROBLOX' && region && <div className="space-y-5 border-t border-pink-100 pt-5 mt-2">
            {methods.length ? (
              <label className="block">
                <span className="block text-sm font-semibold text-neutral-600 mb-2">{c.payment}</span>
                <select className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-4 py-2.5 text-sm font-bold text-neutral-800 focus:outline-none focus:border-pink-500 transition-colors" value={selectedPayment?.id ?? ''} onChange={e => setMethodId(e.target.value)} disabled={busy}>
                  {methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            ) : <p role="status" className="rounded-xl bg-rose-50 border border-rose-100 p-3 text-sm text-rose-700 font-medium">{t.regional.paymentUnavailable}</p>}
            <RegionalPaymentSummary region={region} quote={server.quote} subtotal={variant ? regionalAmount(variant, region) : null} />
            {server.loading && <p role="status" className="text-sm text-neutral-500 animate-pulse">{t.regional.quoteLoading}</p>}
            {server.error && <p role="alert" className="text-sm text-rose-600 font-medium">{errors[server.error] || t.regional.quoteError} <button type="button" onClick={() => { server.retry(); refreshLocation(); }} className="underline ml-1 font-bold">{t.regional.retry}</button></p>}
          </div>}
          {!product.checkoutEnabled && <p role="status" className="text-sm font-bold text-rose-600 bg-rose-50 rounded-xl p-4 text-center border border-rose-100">{c.unavailable}</p>}
          <button className="w-full bg-pink-500 hover:bg-pink-600 hover:shadow-lg hover:shadow-pink-200 transition-all active:scale-95 text-white rounded-2xl py-4 font-black shadow-md disabled:opacity-50 disabled:pointer-events-none mt-4 text-lg" disabled={!variant || !product.checkoutEnabled || busy || (type === 'ROBLOX' && !server.quote)}>{busy ? t.btnProcessing : t.btnPayNow}</button>

          <div className="flex flex-col gap-2 mt-6 border-t border-neutral-100 pt-6">
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span>{c.trustSecure}</span>
            </div>
            {type === 'ROBLOX' && region && (
              <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
                <svg className="w-4 h-4 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span>{c.trustRegional}</span>
              </div>
            )}
          </div>
        </aside>
      </form>}
    </div>
  </StoreShell>;
}
