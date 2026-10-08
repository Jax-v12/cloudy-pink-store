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
  const field = 'block w-full mt-1 border border-pink-200 rounded-xl p-3 bg-white';
  const errors: Record<string, string> = { REGION_UNVERIFIED: t.regional.locationUnavailable, REGION_CHANGED: t.regional.priceChanged, PRICE_CHANGED: t.regional.priceChanged, REGIONAL_PRICE_UNAVAILABLE: t.regional.unavailable, PAYMENT_REGION_UNAVAILABLE: t.regional.paymentUnavailable, PAYMENT_METHOD_UNAVAILABLE: t.regional.paymentUnavailable,
    IDEMPOTENCY_CONFLICT: c.conflict, PRODUCT_UNAVAILABLE: c.checkoutUnavailable, CAPACITY_REVIEW_REQUIRED: c.checkoutUnavailable,
    INVALID_INPUT: t.errIncompleteData, ROBLOX_USER_NOT_FOUND: r.userMissing, GAMEPASS_NOT_FOUND: r.gamepassMissing,
    GAMEPASS_OWNER_MISMATCH: r.ownerMismatch, GAMEPASS_NOT_FOR_SALE: r.notForSale, GAMEPASS_PRICE_MISMATCH: r.wrongPrice,
    RATE_LIMITED: t.rateLimited, RATE_LIMIT_EXCEEDED: t.rateLimited,
  };
  const available = product?.variants.filter(v => type === 'GAME' || v.method === method) ?? [];
  function changeMethod(value: RobloxMethodKey) { setMethod(value); setVariantId(''); setError(''); key.current = { payload: '', value: '' }; }
  return <StoreShell>
    <h1 className="text-3xl sm:text-4xl font-black text-pink-800 mb-3">{product?.name || (type === 'ROBLOX' ? t.robloxFlow.choose : c.GAME)}</h1>
    <p className="text-neutral-600 mb-8 max-w-2xl">{type === 'GAME' ? c.gameDescription : t.robloxFlow.intro}</p>
    {type === 'ROBLOX' && <DetectedLocation region={region} loading={loading} />}
    {type === 'ROBLOX' && slug && <div className="mb-6 max-w-3xl"><h2 className="font-bold mb-3">{r.chooseMethod}</h2><RobloxMethodSelector id="roblox-method" value={method} onChange={changeMethod} disabled={busy} /></div>}
    {error && <p role="alert" className="bg-rose-100 text-rose-800 p-4 rounded-xl mb-4">{errors[error] || t.errSystem}</p>}
    <div {...(type === 'ROBLOX' && slug ? { role: 'tabpanel', id: 'roblox-method-panel', 'aria-labelledby': 'roblox-method-' + method, tabIndex: 0 } : {})}>
      {loading && <p role="status">{t.loadingCatalog}</p>}
      {!loading && products.length === 0 && <p className="p-8 bg-white rounded-2xl">{t.emptyCatalog}</p>}
      {!slug && type === 'ROBLOX' && !loading && products.length > 0 && <RobloxServiceCards products={products} region={region} />}
      {!slug && type === 'GAME' && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{products.map(p => {
        const choices = p.variants.filter(v => type === 'GAME' || v.method === method);
        return <Link key={p.id} href={path + '/' + p.slug} className="block bg-white border border-pink-200 rounded-2xl p-6 hover:shadow-lg transition">
          <h2 className="text-xl font-bold mb-3">{p.name}</h2>
          <p className="text-pink-700 font-semibold">{choices.length ? money(Math.min(...choices.map(v => v.price))) : r.noPackages}</p>
          <p className="mt-4 text-sm">{!p.checkoutEnabled ? c.unavailable : r.viewPackages} →</p>
        </Link>;
      })}</div>}
      {!slug && cursor && <button onClick={more} disabled={loading} className="my-6 p-3 rounded-xl bg-white border border-pink-200">{t.loadMore}</button>}
      {product && region && type === 'ROBLOX' && method === 'GAMEPASS' && <GamepassCheckout key={product.id} productId={product.id} variants={available} region={region} methods={methods} enabled={product.checkoutEnabled} onRegionRefresh={refreshLocation} onBusyChange={setBusy} />}
      {product && region && type === 'ROBLOX' && method === 'GIFT_USERNAME' && <RobloxCheckoutWizard key={product.id + '-username'} method="GIFT_USERNAME" productId={product.id} variants={available} region={region} methods={methods} enabled={product.checkoutEnabled} onRegionRefresh={refreshLocation} onBusyChange={setBusy} />}
      {product && (type !== 'ROBLOX' || (region && method === 'LOGIN')) && <form onSubmit={checkout} className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <fieldset disabled={busy} className="min-w-0 bg-white rounded-3xl border border-pink-200 p-5 sm:p-7 space-y-6">
          <h2 className="font-bold text-lg">{type === 'ROBLOX' ? r.choosePackage : c.package}</h2>
          {available.length === 0 && <p role="status">{r.noPackages}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{available.map(v => <label key={v.id} className={'relative cursor-pointer rounded-xl border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pink-700 ' + (variantId === String(v.id) ? 'border-pink-600 bg-pink-50 ring-1 ring-pink-600' : 'border-pink-200 hover:bg-pink-50')}>
            <input type="radio" className="sr-only" name="package" required value={v.id} checked={variantId === String(v.id)} onChange={() => { setVariantId(String(v.id)); setError(''); }} />
            <span className="block font-bold break-words">{v.name}</span><span className="block text-sm mt-2 text-pink-800">{variantPrice(v)}</span>
          </label>)}</div>
          {variant && <>
            <h2 className="font-bold text-lg border-t border-pink-100 pt-5">{type === 'ROBLOX' ? r.accountDetails : c.userId}</h2>
            {type === 'ROBLOX' && isRobloxMethod(variant.method) ? <RobloxFields key={method} method={variant.method} units={variant.units} /> : <>
              <label className="block">{c.userId}<input className={field} name="userId" maxLength={64} pattern="[A-Za-z0-9_\-]+" required /></label>
              {variant.requiresZone && <label className="block">{c.zoneId}<input className={field} name="zoneId" maxLength={32} required /></label>}
            </>}
            <label className="block">{c.email}<input className={field} type="email" name="email" maxLength={150} autoComplete="email" required /></label>
          </>}
        </fieldset>
        <aside className="bg-white border border-pink-200 rounded-3xl p-6 space-y-5 lg:sticky lg:top-6">
          <h2 className="text-lg font-bold text-pink-900">{r.summary}</h2>
          {type === 'ROBLOX' && <p className="text-sm">{c.method}: <strong>{r[method]}</strong></p>}
          {variant ? <>
            <dl className="space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>{c.package}</dt><dd className="font-semibold text-right">{variant.name}</dd></div>
              <div className="flex justify-between gap-3"><dt>{type === 'ROBLOX' ? r.netRobux : c.units}</dt><dd className="font-semibold">{variant.units}</dd></div>
              {variant.method === 'GAMEPASS' && <div className="flex justify-between gap-3"><dt>{r.priceToSet}</dt><dd className="font-semibold whitespace-nowrap">{robloxGamepassPrice(variant.units)} Robux</dd></div>}
              <div className="border-t border-pink-100 pt-4"><dt>{type === 'ROBLOX' ? t.regional.subtotal : r.total}</dt><dd className="text-2xl font-black text-pink-700 mt-1">{server.quote ? money(server.quote.productSubtotal) : variantPrice(variant)}</dd></div>
            </dl>
            {type === 'ROBLOX' && isRobloxMethod(variant.method) && <RobloxInstructions method={variant.method} gamepassPrice={variant.method === 'GAMEPASS' ? robloxGamepassPrice(variant.units) : null} />}
          </> : <p className="text-sm text-neutral-500">{type === 'ROBLOX' ? r.choosePackage : c.package}</p>}
          {type === 'ROBLOX' && region && <div className="space-y-4">
            {methods.length ? <label>{c.payment}<select className={field} value={selectedPayment?.id ?? ''} onChange={e => setMethodId(e.target.value)} disabled={busy}>{methods.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label> : <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.regional.paymentUnavailable}</p>}
            <RegionalPaymentSummary region={region} quote={server.quote} subtotal={variant ? regionalAmount(variant, region) : null} />
            {server.loading && <p role="status">{t.regional.quoteLoading}</p>}
            {server.error && <p role="alert">{errors[server.error] || t.regional.quoteError} <button type="button" onClick={() => { server.retry(); refreshLocation(); }} className="underline">{t.regional.retry}</button></p>}
          </div>}
          {!product.checkoutEnabled && <p role="status" className="text-sm text-amber-900 bg-amber-50 rounded-xl p-3">{c.unavailable}</p>}
          <button className="w-full bg-pink-600 text-white rounded-xl p-3 font-bold disabled:opacity-40" disabled={!variant || !product.checkoutEnabled || busy || (type === 'ROBLOX' && !server.quote)}>{busy ? t.btnProcessing : t.btnPayNow}</button>
        </aside>
      </form>}
    </div>
  </StoreShell>;
}
