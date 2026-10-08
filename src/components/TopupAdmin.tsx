'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { REGIONS, REGION_CURRENCY, currencyScale, parseMoney, type RegionalPrice, type Region } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';

type Variant = { regionalPrices?: RegionalPrice[]; id?: number; name: string; price: number; units: number; maxUnits?: number | null; unitStep?: number; active: boolean; method: string | null; gamepassPrice: number | null; providerSku: string | null; requiresZone: boolean };
type Product = { id: number; name: string; slug: string; type: 'GAME' | 'ROBLOX'; active: boolean; variants: Variant[] };
const empty: Variant = { name: '', price: 0, units: 50, maxUnits: 5000, unitStep: 5, active: false, method: 'GAMEPASS', gamepassPrice: null, providerSku: null, requiresZone: false };
export default function TopupAdmin() {
  const { t } = useLanguage(); const c = t.commerce;
  const [methods, setMethods] = useState<Record<Region, PaymentMethod[]>>({ ID: [], MY: [], PH: [] });
  const [products, setProducts] = useState<Product[]>([]); const [refresh, setRefresh] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [product, setProduct] = useState<Partial<Product>>({ type: 'ROBLOX', active: false });
  const [productId, setProductId] = useState(0); const [variant, setVariant] = useState<Variant>(empty);
  const [error, setError] = useState(false); const [busy, setBusy] = useState(false);
  const selected = products.find(p => p.id === productId);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/catalog', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(j => { setProducts(j.data); setMethods(j.paymentMethods); setCursor(j.pagination.nextCursor); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [refresh]);
  async function save(body: object) {
    setBusy(true); setError(false);
    try { const r = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(); setRefresh(n => n + 1); }
    catch { setError(true); } finally { setBusy(false); }
  }
  const field = 'block border border-pink-200 rounded-lg p-2 w-full mt-1';
  return <section className="space-y-6">
    <h2 className="text-2xl text-pink-800 font-bold">{c.catalogAdmin}</h2>
    {error && <p role="alert" className="text-rose-700">{c.actionError}</p>}
    <form key={`product-${product.id || 0}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void save({ kind: 'product', id: product.id, type: f.get('type'), name: f.get('name'), slug: f.get('slug'), active: f.has('active') }); }} className="grid sm:grid-cols-2 gap-4 bg-white rounded-2xl border p-5">
      <h3 className="sm:col-span-2 font-bold">{product.id ? c.edit : c.newProduct}</h3>
      <label>{c.product}<select name="type" defaultValue={product.type} className={field}><option value="ROBLOX">{c.ROBLOX}</option><option value="GAME">{c.GAME}</option></select></label>
      <label>{c.name}<input name="name" defaultValue={product.name} required maxLength={100} className={field} /></label>
      <label>{c.slug}<input name="slug" defaultValue={product.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} className={field} /></label>
      <label className="flex gap-2 items-center"><input name="active" type="checkbox" defaultChecked={product.active} />{c.active}</label>
      <button disabled={busy} className="bg-pink-600 text-white rounded-lg p-2">{c.save}</button><button type="button" onClick={() => setProduct({ type: 'ROBLOX', active: false })}>{c.newProduct}</button>
    </form>
    <div className="grid sm:grid-cols-2 gap-3">{products.map(p => <article key={p.id} className="bg-white border rounded-xl p-4 space-y-2">
      <h3 className="font-bold">{p.name}</h3><button onClick={() => setProduct(p)} className="underline text-pink-700">{c.edit}</button>
      <button onClick={() => { setProductId(p.id); setVariant({ ...empty, ...(p.type === 'GAME' ? { units: 1, maxUnits: null, unitStep: 1, method: null } : {}) }); }} className="ml-4 underline text-pink-700">{c.newVariant}</button>
      {p.variants.map(v => <div key={v.id} className="flex gap-3 justify-between text-sm"><span>{v.name} · {v.price}</span><button onClick={() => { setProductId(p.id); setVariant(v); }} className="underline">{c.edit}</button></div>)}
    </article>)}</div>
    {cursor && <button disabled={busy} className="border p-2 rounded-lg" onClick={async () => { setBusy(true); try { const r = await fetch(`/api/admin/catalog?cursor=${cursor}`); if (!r.ok) throw new Error(); const j = await r.json(); setProducts(old => [...old, ...j.data]); setCursor(j.pagination.nextCursor); } catch { setError(true); } finally { setBusy(false); } }}>{t.loadMore}</button>}
    {selected && <form key={`${productId}-${variant.id || 0}`} className="bg-white border rounded-2xl p-5 grid sm:grid-cols-2 gap-4" onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget);
      let regionalPrices: RegionalPrice[] | undefined;
      try {
        if (selected.type === 'ROBLOX') regionalPrices = REGIONS.map(region => ({ region, active: f.has('active-' + region), amount: parseMoney(String(f.get(region === 'ID' ? 'price' : 'price-' + region) || '0'), REGION_CURRENCY[region]) }));
      } catch { setError(true); return; }
      void save({ ...(regionalPrices ? { regionalPrices } : {}), kind: 'variant', productId, id: variant.id, name: f.get('name'), price: Number(f.get('price')), units: Number(f.get('units')), ...(f.has('maxUnits') ? { maxUnits: f.get('maxUnits') ? Number(f.get('maxUnits')) : null, unitStep: Number(f.get('unitStep')) } : {}), method: f.get('method'), providerSku: f.get('sku'), requiresZone: f.has('requiresZone'), active: f.has('active'), capacityConfirmed: f.has('capacity') });
    }}>
      <h3 className="font-bold sm:col-span-2">{selected.name} · {variant.id ? c.edit : c.newVariant}</h3>
      <label>{c.name}<input name="name" defaultValue={variant.name} className={field} maxLength={100} required /></label>
      {selected.type !== 'ROBLOX' && <label>{c.price}<input type="number" min={1} max={2147483647} name="price" defaultValue={variant.price} className={field} required /></label>}
      <label>{selected.type === 'ROBLOX' && ['GAMEPASS', 'GIFT_USERNAME'].includes(variant.method || '') ? t.robloxFlow.baseUnits : c.units}<input type="number" min={1} max={2147483647} name="units" defaultValue={variant.units} className={field} required /></label>
      {selected.type === 'ROBLOX' ? <>
        <label>{c.method}<select name="method" value={variant.method || 'GAMEPASS'} onChange={e => setVariant(v => ({ ...v, method: e.target.value }))} className={field}>{(['GAMEPASS','GIFT_USERNAME','LOGIN'] as const).map(m => <option key={m} value={m}>{c[m]}</option>)}</select></label>
        {['GAMEPASS', 'GIFT_USERNAME'].includes(variant.method || '') && <>
          <label>{t.robloxFlow.maximum}<input type="number" name="maxUnits" min={variant.method === 'GAMEPASS' ? 5 : 1} max={1000000} step={variant.method === 'GAMEPASS' ? 5 : 1} defaultValue={variant.maxUnits ?? ''} className={field} /></label>
          <label>{t.robloxFlow.increment}<input type="number" name="unitStep" min={variant.method === 'GAMEPASS' ? 5 : 1} max={1000000} step={variant.method === 'GAMEPASS' ? 5 : 1} defaultValue={variant.method === 'GAMEPASS' ? Math.max(5, variant.unitStep || 5) : variant.unitStep || 1} className={field} /></label>
          <p className="sm:col-span-2 text-sm text-neutral-600">{variant.method === 'GAMEPASS' ? <>{t.robloxFlow.adminHint} {t.roblox.autoPrice}</> : t.usernameFlow.adminHint}</p>
        </>}
        <label className="flex gap-2 items-center"><input name="capacity" type="checkbox" />{c.capacity}</label>
      </> : <>
        <label>{c.sku}<input name="sku" defaultValue={variant.providerSku || ''} maxLength={100} className={field} required /></label>
        <label className="flex gap-2 items-center"><input name="requiresZone" type="checkbox" defaultChecked={variant.requiresZone} />{c.requiresZone}</label>
      </>}
      {selected.type === 'ROBLOX' && <section className="sm:col-span-2 space-y-4 rounded-xl border border-pink-100 p-4">
        <h4 className="font-bold">{t.regional.pricing}</h4><p className="text-sm text-slate-500">{t.regional.independent}</p>
        <div className="grid gap-4 md:grid-cols-3">{REGIONS.map(region => {
          const row = variant.regionalPrices?.find(p => p.region === region);
          return <div key={region} className="space-y-3 rounded-xl bg-pink-50 p-3">
            <h5 className="font-semibold">{t.regional[region]} · {REGION_CURRENCY[region]}</h5>
            <label className="block text-sm">{t.regional.price}<input name={region === 'ID' ? 'price' : 'price-' + region} type="number" min={region === 'ID' ? 1 : 0} step={region === 'ID' ? 1 : '0.01'} max={region === 'ID' ? 2147483647 : 21474836.47} required={region === 'ID'} defaultValue={region === 'ID' ? variant.price : row ? (row.amount / currencyScale(REGION_CURRENCY[region])).toFixed(2) : ''} className={field} /></label>
            <label className="flex items-center gap-2 text-sm"><input name={'active-' + region} type="checkbox" defaultChecked={row?.active ?? region === 'ID'} />{t.regional.enabled}</label>
            <p className="text-xs text-slate-600">{methods[region].length ? t.regional.providerReady + ': ' + methods[region].map(m => m.label).join(', ') : t.regional.providerMissing}</p>
          </div>;
        })}</div>
      </section>}
      <label className="flex gap-2 items-center"><input name="active" type="checkbox" defaultChecked={variant.active} />{c.active}</label>
      <button disabled={busy} className="bg-pink-600 text-white rounded-lg p-2">{c.save}</button>
    </form>}
  </section>;
}
