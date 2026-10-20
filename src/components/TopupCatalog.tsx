'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from './StoreShell';
import DetectedLocation from './DetectedLocation';
import { useRegionalQuote } from './useRegionalQuote';
import { formatMoney, REGION_CURRENCY, type Region, type RegionalPrice } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';
import GamepassCheckout from './GamepassCheckout';
import RobloxCheckoutWizard from './RobloxCheckoutWizard';
import RobloxServiceCards from './RobloxServiceCards';
import LoginFlow from './LoginFlow';
import type { RobloxMethodKey } from '@/lib/roblox';

type Variant = { regionalPrices?: RegionalPrice[]; id: number; name: string; price: number | null; units: number; maxUnits: number | null; unitStep: number; method: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN' | null; gamepassPrice: number | null; requiresZone: boolean };
type Product = { id: number; name: string; slug: string; variants: Variant[]; checkoutEnabled: boolean };

function Catalog({ type, slug, initialMethod = null }: { type: 'GAME' | 'ROBLOX'; slug?: string; initialMethod?: RobloxMethodKey | null }) {
  const { t, language } = useLanguage(); const c = t.commerce; const r = t.roblox; const f = t.robloxFlow;
  const router = useRouter();
  const [refresh, setRefresh] = useState(0);
  const refreshLocation = () => setRefresh(n => n + 1);
  const [region, setRegion] = useState<Region | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [methodId] = useState('');
  const selectedPayment = methods.find(m => m.id === methodId) ?? methods[0];
  const submitting = useRef(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [variantId, setVariantId] = useState(''); const method = initialMethod ?? null;
  const [busy, setBusy] = useState(false);
  const key = useRef({ payload: '', value: '' });
  const product = slug ? products[0] : undefined;
  const variant = product?.variants.find(v => String(v.id) === variantId);
  const server = useRegionalQuote(type === 'ROBLOX' && method === 'LOGIN' ? product?.id : undefined, variant?.id, region, selectedPayment?.id ?? '');
  const path = type === 'GAME' ? '/games' : '/roblox';
  const money = (n: number) => formatMoney(n, REGION_CURRENCY[region ?? 'ID'], language);
  const variantPrice = (v: Variant) => { const amount = v.price; return amount === null ? t.regional.unavailable : money(amount); };

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
  const available = product?.variants.filter(v => (type === 'GAME' || v.method === method) && v.price !== null) ?? [];

  // High-contrast method badge for detail page
  const methodTitles = { GAMEPASS: f.GAMEPASS, GIFT_USERNAME: f.GIFT_USERNAME, LOGIN: f.LOGIN };

  return <StoreShell>
    {!slug && (
      <div className="mb-6 sm:mb-10 text-center bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-pink-200 mx-auto max-w-3xl">
        <p className="mb-2 text-xs sm:text-sm font-bold text-pink-500 tracking-wider uppercase">{type === 'GAME' ? c.gameHeroEyebrow : c.robloxHeroEyebrow}</p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-pink-800 mb-3">{type === 'GAME' ? c.gameHeroTitle : c.robloxHeroTitle}</h1>
        <p className="text-sm sm:text-base text-neutral-600 font-medium">{type === 'GAME' ? c.gameDescription : f.intro}</p>
      </div>
    )}
    {slug && (
      <div className="mb-8">
        <Link href={`/${type.toLowerCase() === 'game' ? 'games' : 'roblox'}`} className="inline-flex items-center gap-2 bg-white/95 text-sm font-semibold text-pink-800 hover:text-pink-900 hover:bg-pink-50 px-3 py-2 rounded-xl mb-6 transition focus-visible:outline-2 focus-visible:outline-pink-800">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          {c.backToCatalog}
        </Link>
        {type === 'ROBLOX' && method ? (
          <div className="mb-8 bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-pink-200">
            <div className="inline-block rounded-lg bg-pink-100 px-4 py-2 text-xs font-bold uppercase tracking-widest text-pink-800 mb-4">{r[method]}</div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-pink-800 mb-2">{methodTitles[method]}</h1>
            <p className="text-sm sm:text-base text-neutral-600 font-medium">{method === 'GAMEPASS' ? f.description : method === 'LOGIN' ? r.loginTiming : t.usernameFlow.description}</p>
          </div>
        ) : type === 'ROBLOX' && !method ? (
          <div className="mb-8 bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 sm:p-8 shadow-md">
            <h2 className="text-lg font-bold text-amber-900 mb-2">{r.methodRequired}</h2>
            <Link href="/roblox" className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 border border-amber-300 text-amber-800 font-semibold rounded-xl hover:bg-amber-200 transition">
              {c.backToCatalog}
            </Link>
          </div>
        ) : (
          <div className="mb-8 bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border-2 border-pink-200">
            <h1 className="text-3xl sm:text-4xl font-black text-pink-800 mb-3">{product?.name}</h1>
            <p className="text-neutral-600 max-w-2xl">{c.gameDescription}</p>
          </div>
        )}
      </div>
    )}
    {type === 'ROBLOX' && <DetectedLocation region={region} loading={loading} />}
    {error && <p role="alert" className="bg-rose-100 text-rose-800 p-4 rounded-xl mb-4">{errors[error] || t.errSystem}</p>}
    <div>
      {loading && <div><p role="status" className="mb-4 rounded-xl bg-white p-4 text-pink-900">{t.loadingCatalog}</p>{!slug && type === 'ROBLOX' && <div aria-hidden="true" className="grid gap-5 lg:grid-cols-3">{[0, 1, 2].map(key => <div key={key} className="min-h-[30rem] rounded-3xl border-2 border-pink-200 bg-white/95 p-6 motion-safe:animate-pulse"><div className="h-12 w-12 rounded-2xl bg-pink-100" /><div className="mt-6 h-6 w-3/4 rounded bg-pink-100" /><div className="mt-4 h-20 rounded-xl bg-pink-50" /></div>)}</div>}</div>}
      {!loading && products.length === 0 && <p className="p-8 bg-white rounded-2xl">{t.emptyCatalog}</p>}
      {!slug && type === 'ROBLOX' && !loading && <RobloxServiceCards products={products} region={region} />}
      {!slug && type === 'GAME' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">{products.map(p => {
        const choices = p.variants.filter(v => v.price !== null);
        const minPrice = choices.length ? Math.min(...choices.map(v => v.price!)) : null;
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
      {product && type === 'GAME' && <form onSubmit={checkout} className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <fieldset disabled={busy} className="min-w-0 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-pink-200 shadow-xl shadow-pink-900/10 p-6 sm:p-8 space-y-8">
          <div>
            <h2 className="flex items-center gap-2 font-black text-xl text-neutral-800 mb-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-100 text-sm text-pink-700">1</span>
              {c.package}
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
                {c.userId}
              </h2>
              <div className="space-y-4">
                <label className="block">
                  <span className="block font-bold text-sm text-neutral-700 mb-1.5">{c.userId}</span>
                  <input className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-4 py-3 text-neutral-800 focus:outline-none focus:border-pink-500 transition-colors" name="userId" maxLength={64} pattern="[A-Za-z0-9_\-]+" required />
                  <span className="block text-xs text-neutral-500 mt-1.5">{c.userIdHint}</span>
                </label>
                {variant.requiresZone && <label className="block">
                  <span className="block font-bold text-sm text-neutral-700 mb-1.5">{c.zoneId}</span>
                  <input className="w-full bg-neutral-50 border-2 border-pink-200 rounded-xl px-4 py-3 text-neutral-800 focus:outline-none focus:border-pink-500 transition-colors" name="zoneId" maxLength={32} required />
                </label>}
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
          {variant ? <>
            <dl className="space-y-4 text-sm">
              <div className="flex justify-between gap-3 text-neutral-600"><dt>{c.package}</dt><dd className="font-bold text-neutral-800 text-right">{variant.name}</dd></div>
              <div className="flex justify-between gap-3 text-neutral-600"><dt>{c.units}</dt><dd className="font-bold text-neutral-800">{variant.units}</dd></div>
              <div className="border-t border-pink-100 pt-5 mt-2">
                <dt className="text-neutral-500 font-semibold mb-1">{r.total}</dt>
                <dd className="text-3xl font-black text-pink-600 drop-shadow-sm">{variantPrice(variant)}</dd>
              </div>
            </dl>
          </> : (
            <div className="bg-pink-50/50 border border-pink-100 border-dashed rounded-xl p-4 text-center">
              <p className="text-sm font-semibold text-pink-400">{c.package}</p>
            </div>
          )}
          {!product.checkoutEnabled && <p role="status" className="text-sm font-bold text-rose-600 bg-rose-50 rounded-xl p-4 text-center border border-rose-100">{c.unavailable}</p>}
          <button className="w-full bg-pink-500 hover:bg-pink-600 hover:shadow-lg hover:shadow-pink-200 transition-all active:scale-95 text-white rounded-2xl py-4 font-black shadow-md disabled:opacity-50 disabled:pointer-events-none mt-4 text-lg" disabled={!variant || !product.checkoutEnabled || busy}>{busy ? t.btnProcessing : t.btnPayNow}</button>
          <div className="flex flex-col gap-2 mt-6 border-t border-neutral-100 pt-6">
            <div className="flex items-center gap-2 text-xs text-neutral-500 font-medium">
              <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              <span>{c.trustSecure}</span>
            </div>
          </div>
        </aside>
      </form>}
    </div>
  </StoreShell>;
}

export default function TopupCatalog(props: Parameters<typeof Catalog>[0]) {
  if (props.type === 'ROBLOX' && props.slug && props.initialMethod === 'LOGIN') return <LoginFlow slug={props.slug} stage="packages" />;
  return <Catalog {...props} />;
}
