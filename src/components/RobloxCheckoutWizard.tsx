'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fillTemplate, robloxGamepassPrice } from '@/lib/roblox';
import { quoteRobloxQuantity, type RobloxRate } from '@/lib/robloxPricing';
import RobloxFields from './RobloxFields';
import RobloxGamepassGuide from './RobloxGamepassGuide';

type Rate = RobloxRate & { id: number; name: string };
export default function RobloxCheckoutWizard({ method, productId, variants, enabled, onBusyChange }: {
  method: 'GAMEPASS' | 'GIFT_USERNAME'; productId: number; variants: Rate[]; enabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { t, language } = useLanguage(); const f = t.robloxFlow; const r = t.roblox; const c = t.commerce;
  const u = t.usernameFlow; const viaUsername = method === 'GIFT_USERNAME';
  const router = useRouter(); const id = useId(); const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);
  const phase = viaUsername && step >= 2 ? step + 1 : step; const finalStep = viaUsername ? 3 : 4; const [rateId, setRateId] = useState(variants[0]?.id);
  const rate = variants.find(v => v.id === rateId) ?? variants[0];
  const [quantityText, setQuantityText] = useState(String(rate?.units ?? 50));
  const [username, setUsername] = useState(''); const [email, setEmail] = useState(''); const [link, setLink] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const retry = useRef({ payload: '', key: '' }); const submitting = useRef(false);
  useEffect(() => { if (step > 0) heading.current?.focus(); }, [step]);
  const money = (n: number) => new Intl.NumberFormat(language === 'ID' ? 'id-ID' : language === 'MY' ? 'ms-MY' : 'en-US', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
  let quote: ReturnType<typeof quoteRobloxQuantity> | null = null;
  try { if (rate) quote = quoteRobloxQuantity(rate, Number(quantityText)); } catch { /* Display validation next to the editable amount. */ }
  const units = quote?.units ?? rate?.units ?? 50;
  const price = robloxGamepassPrice(units);
  const steps = viaUsername ? [u.infoStep, f.detailsStep, f.paymentStep, f.confirmStep] : [f.orderStep, f.detailsStep, f.passStep, f.paymentStep, f.confirmStep];
  const titles = viaUsername ? [u.title, f.detailsTitle, f.paymentTitle, f.confirmTitle] : [f.title, f.detailsTitle, f.passTitle, f.paymentTitle, f.confirmTitle];
  const intros = viaUsername ? [u.description, u.detailsIntro, f.paymentIntro, u.confirmIntro] : [f.description, f.detailsIntro, f.passIntro, f.paymentIntro, f.confirmIntro];
  const input = 'w-full rounded-2xl border border-pink-200 bg-white px-4 py-3.5 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100';
  const errors: Record<string, string> = { INVALID_INPUT: t.errIncompleteData, IDEMPOTENCY_CONFLICT: c.conflict,
    PRODUCT_UNAVAILABLE: c.checkoutUnavailable, CAPACITY_REVIEW_REQUIRED: c.checkoutUnavailable, ROBLOX_USER_NOT_FOUND: r.userMissing, GAMEPASS_NOT_FOUND: r.gamepassMissing,
    GAMEPASS_OWNER_MISMATCH: r.ownerMismatch, GAMEPASS_NOT_FOR_SALE: r.notForSale, GAMEPASS_PRICE_MISMATCH: r.wrongPrice,
    RATE_LIMIT_EXCEEDED: t.rateLimited };
  function go(next: number) { setError(''); setStep(next); }
  function amount(value: string) { setQuantityText(value); setLink(''); retry.current = { payload: '', key: '' }; }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!rate || busy || submitting.current) return;
    // The introduction has no amount field; let buyers return to the editable details step.
    if (step === 0) { go(1); return; }
    if (!quote) { setError(f.quantityError); return; }
    if (phase === 2) {
      try {
        const url = new URL(link.trim());
        if (url.protocol !== 'https:' || !['www.roblox.com', 'roblox.com'].includes(url.hostname) || url.port || url.username || url.password || url.search || url.hash || !/^\/game-pass\/\d+(?:\/[^/?#]*)?\/?$/.test(url.pathname)) throw new Error();
      } catch { setError(r.gamepassMissing); return; }
    }
    if (step < finalStep) { go(step + 1); return; }
    if (!enabled) return;
    const payload = JSON.stringify({ productId, variantId: rate.id, quantity: quote.units, customerEmail: email.trim(), details: { username: username.trim(), ...(!viaUsername ? { gamepassUrl: link.trim() } : {}) } });
    if (retry.current.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    submitting.current = true; setBusy(true); onBusyChange(true); setError('');
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'idempotency-key': retry.current.key }, body: payload });
      const json = await response.json(); if (!response.ok || !json.success) throw new Error(json.errorCode);
      localStorage.setItem(`token_${json.data.invoice}`, json.data.accessToken);
      router.push(`/order/${encodeURIComponent(json.data.invoice)}`);
    } catch (e) { setError(errors[e instanceof Error ? e.message : ''] || t.errSystem); }
    finally { submitting.current = false; setBusy(false); onBusyChange(false); }
  }
  if (!rate) return <p className="rounded-3xl bg-white p-8 text-center">{r.noPackages}</p>;
  const maximum = rate.maxUnits ?? rate.units; const increment = rate.unitStep ?? 1;
  const progress = maximum === rate.units ? 0 : ((units - rate.units) / (maximum - rate.units)) * 100;
  return <div className="mx-auto max-w-4xl pb-10">
    <ol style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label={c.status} className="mx-auto grid max-w-xl mb-8 sm:mb-12">{steps.map((label, i) => <li key={label} className="relative text-center">
      {i < steps.length - 1 && <span aria-hidden="true" className={`absolute top-5 left-1/2 h-0.5 w-full ${i < step ? 'bg-pink-400' : 'border-t-2 border-dashed border-neutral-300'}`} />}
      <button type="button" disabled={i > step || busy} onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} className="relative px-1 focus-visible:outline-pink-500 disabled:cursor-default">
        <span className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${i <= step ? 'bg-gradient-to-br from-pink-300 to-rose-400 shadow-sm' : 'bg-neutral-400'}`}>{i + 1}</span>
        <span className={`mt-2 block text-[10px] sm:text-xs leading-snug ${i === step ? 'text-pink-900 font-semibold' : 'text-neutral-500'}`}>{label}</span>
      </button>
    </li>)}</ol>
    <form onSubmit={submit} className="rounded-[2rem] border border-pink-100 bg-white px-5 py-8 sm:p-12 shadow-[0_12px_50px_-30px_#ec4899]">
      <fieldset disabled={busy} className="min-w-0">
        <header className="mx-auto mb-8 max-w-xl text-center">
          {step === 0 && <span className="inline-block rounded-full bg-pink-100 px-4 py-2 text-xs font-extrabold tracking-wider text-pink-600 mb-4">{viaUsername ? u.badge : f.badge}</span>}
          <h2 ref={heading} tabIndex={-1} className="text-2xl sm:text-3xl font-black tracking-tight text-pink-400 outline-none">{titles[step]}</h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-500">{intros[step]}</p>
        </header>
        {error && <p role="alert" className="mb-6 rounded-xl bg-rose-50 text-rose-800 p-4">{error}</p>}
        {step === 0 && <div className="mx-auto max-w-lg space-y-5">
          {variants.length > 1 && <label className="block text-sm font-semibold text-slate-600">{f.rate}<select value={rate.id} onChange={e => { const next = variants.find(v => v.id === Number(e.target.value))!; setRateId(next.id); amount(String(next.units)); }} className={`${input} mt-2`}>{variants.map(v => <option key={v.id} value={v.id}>{v.name} · {money(v.price)} / {v.units} Robux</option>)}</select></label>}
          <div className="flex items-center gap-5 rounded-2xl border border-pink-200 p-5"><span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-4xl text-pink-400 rotate-12">◇</span><div><strong className="block text-xl text-slate-800">{money(rate.price)} / {rate.units} Robux</strong><span className="text-sm text-slate-400">{f.baseRate}</span></div></div>
          <div className="rounded-2xl border border-pink-200 p-5"><p className="font-bold text-slate-800">{enabled ? f.available : c.unavailable}</p><p className="text-sm text-slate-500 mt-1">{f.manual}</p></div>
          <p className="text-sm text-center text-slate-400">{f.safeDraft}</p>{viaUsername && <p className="rounded-xl bg-sky-50 p-4 text-sm text-sky-900">{u.privacy}</p>}
        </div>}
        {step === 1 && <div className="space-y-6">
          <RobloxFields method={method} units={units} identityOnly initialUsername={username} onUsernameChange={value => { setUsername(value); setLink(''); }} />
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 sm:gap-4">
            <label className="text-sm font-semibold text-slate-600" htmlFor={`${id}-quantity`}>{f.quantity}<input id={`${id}-quantity`} type="number" inputMode="numeric" min={rate.units} max={maximum} step={increment} value={quantityText} onChange={e => amount(e.target.value)} required aria-describedby={`${id}-hint`} className={`${input} mt-2`} /></label>
            <div className="text-sm font-semibold text-slate-600">{r.total}<output className={`${input} mt-2 block text-pink-700`} aria-live="polite">{quote ? money(quote.totalAmount) : '—'}</output></div>
          </div>
          <div><label className="sr-only" htmlFor={`${id}-range`}>{f.quantity}</label><input id={`${id}-range`} type="range" min={rate.units} max={maximum} step={increment} value={units} onChange={e => amount(e.target.value)} aria-valuetext={`${units} Robux`} aria-describedby={`${id}-hint`} disabled={maximum === rate.units} className="gamepass-range w-full" style={{ background: `linear-gradient(to right, #fb718f ${progress}%, #fce7ef ${progress}%)` }} />
            <div className="mt-2 flex justify-between text-xs text-slate-400"><span>{rate.units} Robux</span><span className="rounded-full bg-pink-100 px-4 py-1 text-sm font-bold text-pink-600">{units} Robux</span><span>{maximum} Robux</span></div>
            <p id={`${id}-hint`} className="mt-3 text-center text-xs text-slate-500">{fillTemplate(f.quantityHelp, { min: rate.units, max: maximum, step: increment })}</p>
            {!quote && <p role="alert" className="mt-2 text-sm text-rose-700">{f.quantityError}</p>}
          </div>
          <label className="block text-sm font-semibold text-slate-600">{c.email}<input type="email" autoComplete="email" maxLength={150} required value={email} onChange={e => setEmail(e.target.value)} className={`${input} mt-2`} /></label>
          <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-5"><h3 className="font-bold text-slate-700">{f.noteTitle}</h3><p className="mt-2 text-sm leading-relaxed text-slate-500">{viaUsername ? u.timing : f.timing}</p></div>
        </div>}
        {phase === 2 && <div className="space-y-6">
          <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600"><p>{f.recipient}: <strong>@{username}</strong></p><p>{r.netRobux}: <strong>{units} Robux</strong></p></div>
          <div className="rounded-3xl bg-pink-50 border border-pink-200 p-6 text-center"><p className="text-sm font-semibold text-pink-700">{f.price}</p><p className="my-3 text-4xl font-black text-pink-500">{price} <span className="text-xl">Robux</span></p><p className="text-sm text-slate-600">{fillTemplate(r.taxNotice, { price, units })}</p></div>
          <div className="flex flex-wrap items-center justify-center gap-4"><a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noopener noreferrer" className="rounded-full bg-pink-100 px-5 py-3 font-semibold text-pink-700">{f.create} ↗</a><RobloxGamepassGuide price={price} /></div>
          <label className="block text-sm font-semibold text-slate-600">{c.gamepassUrl}<input type="url" maxLength={500} required value={link} onChange={e => setLink(e.target.value)} placeholder="https://www.roblox.com/game-pass/123456789" className={`${input} mt-2`} /></label><p className="text-xs text-slate-500">{f.linkHelp}</p>
        </div>}
        {phase === 3 && <label className="flex items-center gap-4 rounded-2xl border-2 border-pink-400 bg-pink-50 p-6"><input type="radio" name="payment" value="QRIS" checked readOnly className="accent-pink-500 h-5 w-5" /><span><strong className="text-xl text-slate-800">{f.qris}</strong><span className="block mt-1 text-sm text-slate-500">{f.qrisDescription}</span></span></label>}
        {(phase === 4 || (viaUsername && phase === 3)) && <div className="space-y-5 mt-5"><dl className="divide-y divide-pink-100 text-sm">{[
          [c.method, r[method]], [f.recipient, '@' + username], [c.email, email], [r.netRobux, `${units} Robux`], ...(!viaUsername ? [[f.price, `${price} Robux`], [c.gamepassUrl, link]] : [[c.price, quote ? money(quote.totalAmount) : '—']]), [c.payment, f.qris],
        ].map(([label, value]) => <div key={label} className="grid sm:grid-cols-[1fr_2fr] gap-1 sm:gap-4 py-3"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-700 break-all sm:text-right">{value}</dd></div>)}</dl><p className="text-xs text-slate-500">{viaUsername ? u.priceNotice : f.feeNotice}</p><div className="flex justify-between gap-4 border-t border-pink-100 pt-5"><span>{r.total}</span><strong className="text-2xl text-pink-500">{quote ? money(quote.totalAmount) : '—'}</strong></div></div>}
        {!enabled && <p role="status" className="mt-6 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{c.unavailable}</p>}
        <div className="mt-9 flex flex-wrap justify-center gap-3">{step > 0 && <button type="button" onClick={() => go(step - 1)} className="rounded-full border border-pink-200 px-6 py-3 font-semibold text-pink-700">{f.previous}</button>}
          <button type="submit" disabled={busy || (step > 0 && !quote) || (phase === 4 && !enabled)} className="min-w-40 rounded-full bg-gradient-to-r from-rose-400 to-pink-300 px-6 py-3 font-bold text-white shadow-sm transition hover:brightness-95 disabled:opacity-40">{busy ? t.btnProcessing : phase === 4 ? f.confirm : f.next}</button>
        </div>
      </fieldset>
    </form>
  </div>;
}
