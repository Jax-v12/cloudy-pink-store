'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import StoreShell from './StoreShell';

type Variant = { id: number; name: string; price: number; units: number; method: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN' | null; gamepassPrice: number | null; requiresZone: boolean };
type Product = { id: number; name: string; slug: string; variants: Variant[]; checkoutEnabled: boolean };
export default function TopupCatalog({ type, slug }: { type: 'GAME' | 'ROBLOX'; slug?: string }) {
  const { t, language } = useLanguage(); const c = t.commerce;
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [variantId, setVariantId] = useState(''); const [method, setMethod] = useState('');
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
        ...(variant.method === 'LOGIN' ? { password: fd.get('password'), backupCodes: String(fd.get('backupCodes')).split(/\r?\n/).map(v => v.trim()).filter(Boolean) } : {}) };
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
  return <StoreShell>
    <h1 className="text-3xl font-black text-pink-800 mb-3">{product?.name || c[type]}</h1>
    <p className="text-neutral-600 mb-8">{type === 'GAME' ? c.gameDescription : c.robloxDescription}</p>
    {error && <p role="alert" className="bg-rose-100 text-rose-800 p-4 rounded-xl mb-4">{error === 'IDEMPOTENCY_CONFLICT' ? c.conflict : ['PRODUCT_UNAVAILABLE', 'CAPACITY_REVIEW_REQUIRED'].includes(error) ? c.checkoutUnavailable : error === 'INVALID_INPUT' ? t.errIncompleteData : t.errSystem}</p>}
    {loading && <p role="status">{t.loadingCatalog}</p>}
    {!loading && products.length === 0 && <p className="p-8 bg-white rounded-2xl">{t.emptyCatalog}</p>}
    {!slug && <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{products.map(p => <Link key={p.id} href={`${path}/${p.slug}`} className="block bg-white border border-pink-200 rounded-2xl p-6 hover:shadow-lg transition">
      <h2 className="text-xl font-bold mb-3">{p.name}</h2><p className="text-pink-700">{p.variants[0] ? money(p.variants[0].price) : c.unavailable}</p>
      {!p.checkoutEnabled && <p className="mt-3 text-sm text-neutral-500">{c.unavailable}</p>}
    </Link>)}</div>}
    {!slug && cursor && <button onClick={more} disabled={loading} className="my-6 p-3 rounded-xl bg-white border border-pink-200">{t.loadMore}</button>}
    {product && <form onSubmit={checkout} className="max-w-xl bg-white rounded-3xl border border-pink-200 p-6 space-y-5">
      {type === 'ROBLOX' && <label className="block font-medium">{c.method}<select className={field} value={method} onChange={e => { setMethod(e.target.value); setVariantId(''); }} required>
        <option value="">{c.method}</option>{(['GAMEPASS', 'GIFT_USERNAME', 'LOGIN'] as const).map(m => <option key={m} value={m}>{c[m]}</option>)}
      </select></label>}
      <label className="block font-medium">{c.package}<select required value={variantId} className={field} onChange={e => setVariantId(e.target.value)}>
        <option value="">{c.package}</option>{product.variants.filter(v => type === 'GAME' || v.method === method).map(v => <option key={v.id} value={v.id}>{v.name} — {money(v.price)}</option>)}
      </select></label>
      {variant && <>
        <p>{c.units}: <strong>{variant.units}</strong></p>
        {variant.gamepassPrice && <p>{c.gamepassPrice}: <strong>{variant.gamepassPrice}</strong></p>}
        <label className="block">{c.email}<input className={field} type="email" name="email" maxLength={150} required /></label>
        {type === 'GAME' ? <>
          <label className="block">{c.userId}<input className={field} name="userId" maxLength={64} pattern="[A-Za-z0-9_\-]+" required /></label>
          {variant.requiresZone && <label className="block">{c.zoneId}<input className={field} name="zoneId" maxLength={32} required /></label>}
        </> : <>
          <label className="block">{c.username}<input className={field} name="username" minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required /></label>
          {variant.method === 'GAMEPASS' && <><label className="block">{c.gamepassUrl}<input className={field} name="gamepassUrl" type="url" maxLength={500} required /></label><p className="text-sm text-neutral-600">{c.passNotice}</p></>}
          {variant.method === 'GIFT_USERNAME' && <p className="text-sm text-neutral-600">{c.giftNotice}</p>}
          {variant.method === 'LOGIN' && <>
            <label className="block">{c.password}<input className={field} name="password" type="password" autoComplete="off" maxLength={1024} required /></label>
            <label className="block">{c.backupCodes}<textarea className={field} name="backupCodes" autoComplete="off" spellCheck={false} rows={5} maxLength={350} required /></label>
            <p className="text-sm text-neutral-600">{c.secretNotice}</p><p className="text-sm text-neutral-600">{c.loginNotice}</p>
          </>}
        </>}
      </>}
      {!product.checkoutEnabled && <p role="status">{c.unavailable}</p>}
      <button className="w-full bg-pink-600 text-white rounded-xl p-3 font-bold disabled:opacity-40" disabled={!variant || !product.checkoutEnabled || busy}>{busy ? t.btnProcessing : t.btnPayNow}</button>
    </form>}
  </StoreShell>;
}
