'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { REGIONS, REGION_CURRENCY, currencyScale, parseMoney, type RegionalPrice, type Region } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';
import AdminDialog from './AdminDialog';

type Variant = { regionalPrices?: RegionalPrice[]; id?: number; name: string; price: number; units: number; maxUnits?: number | null; unitStep?: number; active: boolean; method: string | null; gamepassPrice: number | null; providerSku: string | null; requiresZone: boolean };
type Product = { id: number; name: string; slug: string; type: 'GAME' | 'ROBLOX'; active: boolean; updatedAt: string; deletion: { allowed: boolean; reasonCodes: string[] }; variants: Variant[] };
const empty: Variant = { name: '', price: 0, units: 50, maxUnits: 5000, unitStep: 5, active: false, method: 'GAMEPASS', gamepassPrice: null, providerSku: null, requiresZone: false };
export default function TopupAdmin() {
  const { t } = useLanguage(); const c = t.commerce;
  const [methods, setMethods] = useState<Record<Region, PaymentMethod[]>>({ ID: [], MY: [], PH: [] });
  const [products, setProducts] = useState<Product[]>([]); const [refresh, setRefresh] = useState(0);
  const [cursor, setCursor] = useState<number | null>(null);
  const [product, setProduct] = useState<Partial<Product>>({ type: 'ROBLOX', active: false });
  const [productId, setProductId] = useState(0); const [variant, setVariant] = useState<Variant>(empty);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [confirmationName, setConfirmationName] = useState('');
  const [notice, setNotice] = useState(false);
  const errorLabel = (code: string) => c[code as keyof typeof c] || c.actionError;
  const selected = products.find(p => p.id === productId);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/catalog', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(j => { setProducts(j.data); setMethods(j.paymentMethods); setCursor(j.pagination.nextCursor); })
      .catch(() => { if (!controller.signal.aborted) setError('SYSTEM_ERROR'); });
    return () => controller.abort();
  }, [refresh]);
  async function save(body: object) {
    setBusy(true); setError(''); setNotice(false);
    try { const r = await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.errorCode || 'SYSTEM_ERROR'); setRefresh(n => n + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'SYSTEM_ERROR'); } finally { setBusy(false); }
  }
  async function lifecycle(target: Product, deleting: boolean, password?: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice(false);
    try {
      if (deleting) {
        const auth = await fetch('/api/admin/reauth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
        const result = await auth.json(); if (!auth.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
      }
      const response = await fetch(`/api/admin/catalog/${target.id}`, { method: deleting ? 'DELETE' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedUpdatedAt: target.updatedAt, ...(deleting ? { confirmationName } : { active: !target.active }) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.errorCode || 'SYSTEM_ERROR');
      setDeleteTarget(null); setConfirmationName('');
      if (product.id === target.id) setProduct(deleting ? { type: 'ROBLOX', active: false } : { ...target, ...result.data });
      if (deleting && productId === target.id) { setProductId(0); setVariant(empty); }
      setNotice(true); setRefresh(n => n + 1);
    } catch (e) {
      const code = e instanceof Error ? e.message : 'SYSTEM_ERROR'; setError(code);
      if (!['REAUTH_REQUIRED', 'INVALID_CREDENTIALS', 'RATE_LIMIT_EXCEEDED'].includes(code)) {
        setDeleteTarget(null); setConfirmationName(''); setRefresh(n => n + 1);
      }
    } finally { setBusy(false); }
  }
  const field = 'block w-full mt-1.5 border-2 border-pink-100 rounded-xl px-4 py-2.5 bg-white focus:border-pink-500 focus:outline-none focus:ring-4 focus:ring-pink-50 transition-all';
  const labelText = 'block text-sm font-bold text-neutral-700';

  return <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-pink-100 pb-5">
      <div>
        <h2 className="text-3xl text-pink-800 font-black tracking-tight">{c.catalogAdmin}</h2>
        <p className="text-neutral-500 mt-2 font-medium">{c.adminCatalogIntro}</p>
      </div>
      <button disabled={busy} onClick={() => { setError(''); setRefresh(n => n + 1); }} className="flex items-center gap-2 rounded-xl border-2 border-pink-200 px-4 py-2 text-sm font-bold text-pink-600 hover:bg-pink-50 transition active:scale-95 disabled:opacity-50">
        <svg className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        {c.refresh}
      </button>
    </div>

    {error && !deleteTarget && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-4 font-semibold shadow-sm">{errorLabel(error)}</p>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 font-semibold shadow-sm">{c.actionSaved}</p>}

    {deleteTarget && <AdminDialog title={c.deleteProduct} busy={busy} onClose={() => setDeleteTarget(null)}>
      <p className="mb-3 break-words font-black text-lg text-neutral-800">{deleteTarget.name}</p>
      <p className="mb-5 text-sm text-neutral-600 font-medium">{deleteTarget.deletion.allowed ? c.deleteWarning : c.deleteBlocked}</p>
      {error && <p role="alert" className="mb-4 text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-100 font-semibold">{errorLabel(error)}</p>}
      {deleteTarget.deletion.allowed ? <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const password = String(f.get('password') || ''); e.currentTarget.reset(); void lifecycle(deleteTarget, true, password); }}>
        <label className={labelText}>{c.confirmProductName}<input autoFocus required maxLength={100} value={confirmationName} onChange={e => setConfirmationName(e.target.value)} className={field} /></label>
        <label className={labelText}>{c.adminPassword}<input required type="password" name="password" autoComplete="current-password" maxLength={1024} className={field} /></label>
        <div className="flex flex-wrap gap-3 pt-4"><button disabled={busy || confirmationName !== deleteTarget.name} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl p-3 disabled:opacity-40 shadow-sm transition active:scale-95">{c.reauthDelete}</button><button type="button" disabled={busy} onClick={() => setDeleteTarget(null)} className="flex-1 border-2 border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50 rounded-xl p-3 transition active:scale-95">{c.cancelAction}</button></div>
      </form> : <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
          {deleteTarget.deletion.reasonCodes.map(code => <p key={code} className="text-sm font-semibold text-amber-800">{errorLabel(code)}</p>)}
        </div>
        <div className="flex flex-wrap gap-3 pt-2">{deleteTarget.active && <button disabled={busy} onClick={() => void lifecycle(deleteTarget, false)} className="flex-1 bg-neutral-800 text-white font-bold hover:bg-neutral-700 rounded-xl p-3 shadow-sm transition active:scale-95">{c.deactivateProduct}</button>}<button disabled={busy} onClick={() => setDeleteTarget(null)} className="flex-1 border-2 border-neutral-200 text-neutral-600 font-bold hover:bg-neutral-50 rounded-xl p-3 transition active:scale-95">{c.cancelAction}</button></div>
      </div>}
    </AdminDialog>}

    <form key={`product-${product.id || 0}`} onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void save({ kind: 'product', id: product.id, type: f.get('type'), name: f.get('name'), slug: f.get('slug'), active: f.has('active') }); }} className="grid sm:grid-cols-2 gap-5 bg-white rounded-[2rem] border-2 border-pink-100 shadow-xl shadow-pink-900/5 p-6 sm:p-8 hover:shadow-2xl hover:border-pink-200 transition-all duration-300">
      <div className="sm:col-span-2 flex items-center justify-between border-b border-pink-50 pb-4">
        <h3 className="font-black text-xl text-neutral-800">{product.id ? c.productDetails : c.newProduct}</h3>
        {product.id && <button type="button" onClick={() => setProduct({ type: 'ROBLOX', active: false })} className="text-sm font-bold text-pink-600 hover:text-pink-700">{c.newProduct}</button>}
      </div>
      <label className={labelText}>{c.product}<select name="type" defaultValue={product.type} className={field}><option value="ROBLOX">{c.ROBLOX}</option><option value="GAME">{c.GAME}</option></select></label>
      <label className={labelText}>{c.name}<input name="name" defaultValue={product.name} required maxLength={100} className={field} /></label>
      <label className={labelText}>{c.slug}<input name="slug" defaultValue={product.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={100} className={field} /></label>
      <label className="flex gap-3 items-center cursor-pointer select-none mt-2"><input name="active" type="checkbox" defaultChecked={product.active} key={String(product.active)} className="w-5 h-5 accent-pink-600 rounded cursor-pointer" /><span className="font-bold text-neutral-700">{c.active}</span></label>

      <div className="sm:col-span-2 flex gap-3 pt-4 border-t border-pink-50">
        <button disabled={busy} className="bg-pink-600 hover:bg-pink-700 text-white font-black shadow-md shadow-pink-200/50 rounded-xl px-8 py-3 transition active:scale-95">{c.save}</button>
      </div>
    </form>

    <div className="grid lg:grid-cols-2 gap-6">
      {products.map(p => (
        <article key={p.id} className="bg-white border-2 border-pink-100 shadow-lg shadow-pink-900/5 hover:shadow-2xl hover:shadow-pink-900/10 hover:border-pink-300 hover:-translate-y-1 rounded-[2.5rem] p-6 sm:p-8 transition-all duration-300 group flex flex-col">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="font-black text-xl text-neutral-800 group-hover:text-pink-600 transition-colors">{p.name}</h3>
              <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black ${p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {p.active ? c.active : c.inactive}
                </span>
                <span className="text-xs font-bold text-pink-400 px-2.5 py-0.5 bg-pink-50 rounded-full">{p.type}</span>
              </div>
            </div>
            <button onClick={() => setProduct(p)} className="p-2 rounded-xl text-pink-600 hover:bg-pink-50 transition" title={c.edit}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            <button disabled={busy} onClick={() => void lifecycle(p, false)} className="text-xs font-bold border-2 border-neutral-200 text-neutral-600 hover:bg-neutral-50 rounded-lg px-3 py-1.5 transition active:scale-95">
              {p.active ? c.deactivateProduct : c.reactivateProduct}
            </button>
            <button disabled={busy} onClick={() => { setError(''); setConfirmationName(''); setDeleteTarget(p); }} className="text-xs font-bold border-2 border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg px-3 py-1.5 transition active:scale-95">
              {c.deleteProduct}
            </button>
          </div>

          <div className="mt-auto border-t border-pink-50 pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-neutral-500">{c.packagesLabel} ({p.variants.length})</span>
              <button onClick={() => { setProductId(p.id); setVariant({ ...empty, ...(p.type === 'GAME' ? { units: 1, maxUnits: null, unitStep: 1, method: null } : {}) }); }} className="text-xs font-black text-pink-600 hover:text-pink-700 bg-pink-50 hover:bg-pink-100 rounded-lg px-3 py-1.5 transition active:scale-95">
                + {c.newVariant}
              </button>
            </div>
            {p.variants.length === 0 ? (
              <p className="text-sm font-medium text-neutral-400 italic">{c.noPackagesAdmin}</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                {p.variants.map(v => (
                  <div key={v.id} className={`flex items-center justify-between group/variant rounded-xl border p-2.5 transition ${productId === p.id && variant.id === v.id ? 'bg-pink-50 border-pink-300' : 'bg-neutral-50 border-transparent hover:border-pink-200 hover:bg-white'}`}>
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-bold text-neutral-800 truncate">{v.name}</p>
                      <p className="text-xs font-semibold text-pink-600">{v.units} U</p>
                    </div>
                    <button onClick={() => { setProductId(p.id); setVariant(v); }} className="shrink-0 text-xs font-bold text-pink-600 hover:text-pink-800 bg-white border border-pink-200 shadow-sm rounded-lg px-3 py-1 opacity-0 group-hover/variant:opacity-100 transition-opacity">
                      {c.edit}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
    {cursor && (
      <div className="flex justify-center mt-6">
        <button disabled={busy} className="bg-white border-2 border-pink-200 text-pink-700 font-bold hover:bg-pink-50 rounded-xl px-8 py-3 shadow-sm transition active:scale-95 disabled:opacity-50" onClick={async () => { setBusy(true); try { const r = await fetch(`/api/admin/catalog?cursor=${cursor}`); if (!r.ok) throw new Error(); const j = await r.json(); setProducts(old => [...old, ...j.data]); setCursor(j.pagination.nextCursor); } catch { setError('SYSTEM_ERROR'); } finally { setBusy(false); } }}>
          {t.loadMore}
        </button>
      </div>
    )}

    {selected && (
      <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200 overflow-y-auto">
        <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
          <div className="flex items-center justify-between border-b border-pink-100 bg-pink-50/50 px-6 py-4">
            <h3 className="font-black text-xl text-neutral-800">
              <span className="text-pink-600">{selected.name}</span> <span className="text-neutral-300 mx-2">/</span> {variant.id ? c.edit : c.newVariant}
            </h3>
            <button type="button" onClick={() => setProductId(0)} className="text-neutral-400 hover:text-neutral-700 p-1 transition" title={c.closeEditor}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form key={`${productId}-${variant.id || 0}`} className="p-6 grid sm:grid-cols-2 gap-5 max-h-[75vh] overflow-y-auto custom-scrollbar" onSubmit={e => {
            e.preventDefault(); const f = new FormData(e.currentTarget);
            let regionalPrices: RegionalPrice[] | undefined;
            try {
              if (selected.type === 'ROBLOX') regionalPrices = REGIONS.map(region => ({ region, active: f.has('active-' + region), amount: parseMoney(String(f.get(region === 'ID' ? 'price' : 'price-' + region) || '0'), REGION_CURRENCY[region]) }));
            } catch { setError('INVALID_INPUT'); return; }
            void save({ ...(regionalPrices ? { regionalPrices } : {}), kind: 'variant', productId, id: variant.id, name: f.get('name'), price: Number(f.get('price')), units: Number(f.get('units')), ...(f.has('maxUnits') ? { maxUnits: f.get('maxUnits') ? Number(f.get('maxUnits')) : null, unitStep: Number(f.get('unitStep')) } : {}), method: f.get('method'), providerSku: f.get('sku'), requiresZone: f.has('requiresZone'), active: f.has('active'), capacityConfirmed: f.has('capacity') });
          }}>
            <label className={labelText}>{c.name}<input name="name" defaultValue={variant.name} className={field} maxLength={100} required /></label>
            {selected.type !== 'ROBLOX' && <label className={labelText}>{c.price}<input type="number" min={1} max={2147483647} name="price" defaultValue={variant.price} className={field} required /></label>}
            <label className={labelText}>{selected.type === 'ROBLOX' && ['GAMEPASS', 'GIFT_USERNAME'].includes(variant.method || '') ? t.robloxFlow.baseUnits : c.units}<input type="number" min={1} max={2147483647} name="units" defaultValue={variant.units} className={field} required /></label>

            {selected.type === 'ROBLOX' ? <>
              <label className={labelText}>{c.method}<select name="method" value={variant.method || 'GAMEPASS'} onChange={e => setVariant(v => ({ ...v, method: e.target.value }))} className={field}>{(['GAMEPASS','GIFT_USERNAME','LOGIN'] as const).map(m => <option key={m} value={m}>{c[m]}</option>)}</select></label>
              {['GAMEPASS', 'GIFT_USERNAME'].includes(variant.method || '') && <>
                <label className={labelText}>{t.robloxFlow.maximum}<input type="number" name="maxUnits" min={variant.method === 'GAMEPASS' ? 5 : 1} max={1000000} step={variant.method === 'GAMEPASS' ? 5 : 1} defaultValue={variant.maxUnits ?? ''} className={field} /></label>
                <label className={labelText}>{t.robloxFlow.increment}<input type="number" name="unitStep" min={variant.method === 'GAMEPASS' ? 5 : 1} max={1000000} step={variant.method === 'GAMEPASS' ? 5 : 1} defaultValue={variant.method === 'GAMEPASS' ? Math.max(5, variant.unitStep || 5) : variant.unitStep || 1} className={field} /></label>
                <p className="sm:col-span-2 text-sm font-medium text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-100">{variant.method === 'GAMEPASS' ? <>{t.robloxFlow.adminHint} <br/>{t.roblox.autoPrice}</> : t.usernameFlow.adminHint}</p>
              </>}
              <label className="flex gap-3 items-center cursor-pointer select-none mt-2"><input name="capacity" type="checkbox" className="w-5 h-5 accent-pink-600 rounded cursor-pointer" /><span className="font-bold text-neutral-700">{c.capacity}</span></label>
            </> : <>
              <label className={labelText}>{c.sku}<input name="sku" defaultValue={variant.providerSku || ''} maxLength={100} className={field} required /></label>
              <label className="flex gap-3 items-center cursor-pointer select-none mt-2"><input name="requiresZone" type="checkbox" defaultChecked={variant.requiresZone} className="w-5 h-5 accent-pink-600 rounded cursor-pointer" /><span className="font-bold text-neutral-700">{c.requiresZone}</span></label>
            </>}

            {selected.type === 'ROBLOX' && (
              <section className="sm:col-span-2 space-y-4 rounded-2xl border-2 border-pink-100 bg-white p-5 mt-2 shadow-sm">
                <div>
                  <h4 className="font-black text-lg text-neutral-800">{c.regionsLabel}</h4>
                  <p className="text-sm text-neutral-500 font-medium">{t.regional.independent}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  {REGIONS.map(region => {
                    const row = variant.regionalPrices?.find(p => p.region === region);
                    return <div key={region} className="flex flex-col rounded-xl bg-pink-50/50 border border-pink-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-black text-pink-700">{t.regional[region]}</h5>
                        <span className="text-xs font-bold bg-pink-100 text-pink-600 px-2 py-0.5 rounded-md">{REGION_CURRENCY[region]}</span>
                      </div>
                      <label className={labelText}>
                        <input name={region === 'ID' ? 'price' : 'price-' + region} type="number" min={region === 'ID' ? 1 : 0} step={region === 'ID' ? 1 : '0.01'} max={region === 'ID' ? 2147483647 : 21474836.47} required={region === 'ID'} defaultValue={region === 'ID' ? variant.price : row ? (row.amount / currencyScale(REGION_CURRENCY[region])).toFixed(2) : ''} className={field} placeholder="0" />
                      </label>
                      <label className="flex items-center gap-2 mt-3 mb-2 cursor-pointer select-none"><input name={'active-' + region} type="checkbox" defaultChecked={row?.active ?? region === 'ID'} className="w-4 h-4 accent-pink-600 rounded cursor-pointer" /><span className="text-sm font-bold text-neutral-700">{t.regional.enabled}</span></label>
                      <div className="mt-auto pt-2 border-t border-pink-100">
                        <p className="text-[10px] font-semibold text-neutral-500 leading-tight">
                          {methods[region].length ? t.regional.providerReady + ': ' + methods[region].map(m => m.label).join(', ') : <span className="text-rose-600">{t.regional.providerMissing}</span>}
                        </p>
                      </div>
                    </div>;
                  })}
                </div>
              </section>
            )}

            <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-4 border-t border-pink-100 pt-5 mt-2">
              <label className="flex gap-3 items-center cursor-pointer select-none"><input name="active" type="checkbox" defaultChecked={variant.active} className="w-5 h-5 accent-pink-600 rounded cursor-pointer" /><span className="font-bold text-neutral-700">{c.active}</span></label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setProductId(0)} className="text-neutral-600 font-bold px-6 py-2.5 rounded-xl hover:bg-neutral-100 transition active:scale-95">{c.cancelAction}</button>
                <button disabled={busy} className="bg-pink-600 hover:bg-pink-700 text-white font-black shadow-md shadow-pink-200/50 rounded-xl px-8 py-2.5 transition active:scale-95">{c.save}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    )}
  </section>;
}
