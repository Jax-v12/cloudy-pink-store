'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from './StoreShell';
import RobloxMethodSelector from './RobloxMethodSelector';
import RobloxFields from './RobloxFields';
import RobloxInstructions from './RobloxInstructions';
import { isRobloxMethod, robloxGamepassPrice, type RobloxMethodKey } from '@/lib/roblox';

type Variant = { id: number; name: string; price: number; units: number; method: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN' | null; gamepassPrice: number | null; requiresZone: boolean };
type Product = { id: number; name: string; slug: string; variants: Variant[]; checkoutEnabled: boolean };
export default function TopupCatalog({ type, slug, initialMethod = 'GAMEPASS' }: { type: 'GAME' | 'ROBLOX'; slug?: string; initialMethod?: RobloxMethodKey }) {
  const { t, language } = useLanguage(); const c = t.commerce; const r = t.roblox;
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [variantId, setVariantId] = useState(''); const [method, setMethod] = useState<RobloxMethodKey>(initialMethod);
  const [busy, setBusy] = useState(false);
  const key = useRef({ payload: '', value: '' });
  const product = slug ? products[0] : undefined;
  const variant = product?.variants.find(v => String(v.id) === variantId);
  const path = type === 'GAME' ? '/games' : '/roblox';
  const money = (n: number) => new Intl.NumberFormat(language === 'ID' ? 'id-ID' : language === 'MY' ? 'ms-MY' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products?type=${type}${slug ? `&slug=${encodeURIComponent(slug)}` : ''}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(j => { setProducts(j.data); setCursor(j.pagination.nextCursor); })
      .catch(() => { if (!controller.signal.aborted) setError('load'); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => { controller.abort(); key.current = { payload: '', value: '' }; };
  }, [type, slug]);
  async function more() {
    setLoading(true);
    try { const r = await fetch(`/api/products?type=${type}&cursor=${cursor}`); if (!r.ok) throw new Error(); const j = await r.json(); setProducts(p => [...p, ...j.data]); setCursor(j.pagination.nextCursor); }
    catch { setError('load'); } finally { setLoading(false); }
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!product || !variant || busy) return;
    const form = event.currentTarget; const fd = new FormData(form);
    const details: Record<string, unknown> = type === 'GAME' ? { userId: fd.get('userId'), ...(variant.requiresZone ? { zoneId: fd.get('zoneId') } : {}) }
      : { username: fd.get('username'), ...(variant.method === 'GAMEPASS' ? { gamepassUrl: fd.get('gamepassUrl') } : {}),
        ...(variant.method === 'LOGIN' ? { password: fd.get('password'), backupCodes: String(fd.get('backupCodes') || '').split(/\r?\n/).map(v => v.trim()).filter(Boolean), note: fd.get('note') || undefined } : {}) };
    const payload = JSON.stringify({ productId: product.id, variantId: variant.id, customerEmail: fd.get('email'), details });
    if (key.current.payload !== payload) key.current = { payload, value: crypto.randomUUID() };
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': key.current.value }, body: payload });
      const j = await r.json(); if (!r.ok || !j.success) throw new Error(j.errorCode);
      localStorage.setItem(`token_${j.data.invoice}`, j.data.accessToken);
      form.reset(); key.current = { payload: '', value: '' };
      router.push(`/order/${encodeURIComponent(j.data.invoice)}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'SYSTEM_ERROR'); }
    finally { setBusy(false); }
  }
  const field = 'block w-full mt-1 border border-pink-200 rounded-xl p-3 bg-white';
  const errors: Record<string, string> = {
    IDEMPOTENCY_CONFLICT: c.conflict, PRODUCT_UNAVAILABLE: c.checkoutUnavailable, CAPACITY_REVIEW_REQUIRED: c.checkoutUnavailable,
    INVALID_INPUT: t.errIncompleteData, ROBLOX_USER_NOT_FOUND: r.userMissing, GAMEPASS_NOT_FOUND: r.gamepassMissing,
    GAMEPASS_OWNER_MISMATCH: r.ownerMismatch, GAMEPASS_NOT_FOR_SALE: r.notForSale, GAMEPASS_PRICE_MISMATCH: r.wrongPrice,
    RATE_LIMITED: t.rateLimited, RATE_LIMIT_EXCEEDED: t.rateLimited,
  };
  const available = product?.variants.filter(v => type === 'GAME' || v.method === method) ?? [];
  function changeMethod(value: RobloxMethodKey) { setMethod(value); setVariantId(''); setError(''); key.current = { payload: '', value: '' }; }
  return <StoreShell>
    <h1 className="text-3xl sm:text-4xl font-black text-pink-800 mb-3">{product?.name || (type === 'ROBLOX' ? r.title : c.GAME)}</h1>
    <p className="text-neutral-600 mb-8 max-w-2xl">{type === 'GAME' ? c.gameDescription : r.subtitle}</p>
    {type === 'ROBLOX' && <div className="mb-6 max-w-3xl"><h2 className="font-bold mb-3">{r.chooseMethod}</h2><RobloxMethodSelector id="roblox-method" value={method} onChange={changeMethod} disabled={busy} /></div>}
    {error && <p role="alert" className="bg-rose-100 text-rose-800 p-4 rounded-xl mb-4">{errors[error] || t.errSystem}</p>}
    <div {...(type === 'ROBLOX' ? { role: 'tabpanel', id: 'roblox-method-panel', 'aria-labelledby': 'roblox-method-' + method, tabIndex: 0 } : {})}>
      {loading && <p role="status">{t.loadingCatalog}</p>}
      {!loading && products.length === 0 && <p className="p-8 bg-white rounded-2xl">{t.emptyCatalog}</p>}
      {!slug && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{products.map(p => {
        const choices = p.variants.filter(v => type === 'GAME' || v.method === method);
        return <Link key={p.id} href={path + '/' + p.slug + (type === 'ROBLOX' ? '?method=' + method : '')} className="block bg-white border border-pink-200 rounded-2xl p-6 hover:shadow-lg transition">
          <h2 className="text-xl font-bold mb-3">{p.name}</h2>
          {type === 'ROBLOX' && <p className="text-sm mb-3">{r[method]}</p>}
          <p className="text-pink-700 font-semibold">{choices.length ? money(Math.min(...choices.map(v => v.price))) : r.noPackages}</p>
          <p className="mt-4 text-sm">{!p.checkoutEnabled ? c.unavailable : r.viewPackages} →</p>
        </Link>;
      })}</div>}
      {!slug && cursor && <button onClick={more} disabled={loading} className="my-6 p-3 rounded-xl bg-white border border-pink-200">{t.loadMore}</button>}
      {product && <form onSubmit={checkout} className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <fieldset disabled={busy} className="min-w-0 bg-white rounded-3xl border border-pink-200 p-5 sm:p-7 space-y-6">
          <h2 className="font-bold text-lg">{type === 'ROBLOX' ? r.choosePackage : c.package}</h2>
          {available.length === 0 && <p role="status">{r.noPackages}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{available.map(v => <label key={v.id} className={'relative cursor-pointer rounded-xl border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-pink-700 ' + (variantId === String(v.id) ? 'border-pink-600 bg-pink-50 ring-1 ring-pink-600' : 'border-pink-200 hover:bg-pink-50')}>
            <input type="radio" className="sr-only" name="package" required value={v.id} checked={variantId === String(v.id)} onChange={() => { setVariantId(String(v.id)); setError(''); }} />
            <span className="block font-bold break-words">{v.name}</span><span className="block text-sm mt-2 text-pink-800">{money(v.price)}</span>
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
              <div className="border-t border-pink-100 pt-4"><dt>{r.total}</dt><dd className="text-2xl font-black text-pink-700 mt-1">{money(variant.price)}</dd></div>
            </dl>
            {type === 'ROBLOX' && isRobloxMethod(variant.method) && <RobloxInstructions method={variant.method} gamepassPrice={variant.method === 'GAMEPASS' ? robloxGamepassPrice(variant.units) : null} />}
          </> : <p className="text-sm text-neutral-500">{type === 'ROBLOX' ? r.choosePackage : c.package}</p>}
          {!product.checkoutEnabled && <p role="status" className="text-sm text-amber-900 bg-amber-50 rounded-xl p-3">{c.unavailable}</p>}
          <button className="w-full bg-pink-600 text-white rounded-xl p-3 font-bold disabled:opacity-40" disabled={!variant || !product.checkoutEnabled || busy}>{busy ? t.btnProcessing : t.btnPayNow}</button>
        </aside>
      </form>}
    </div>
  </StoreShell>;
}
