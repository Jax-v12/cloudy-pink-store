'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useLoginDraft } from '@/context/LoginDraftContext';
import { getCountries, getCountryCallingCode, normalizeWhatsapp, validateLoginAccount, type CountryCode } from '@/lib/loginContact';
import { formatMoney, REGION_CURRENCY, type Region } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';
import StoreShell from './StoreShell';
import DetectedLocation from './DetectedLocation';
import RegionalPaymentSummary from './RegionalPaymentSummary';
import { useRegionalQuote } from './useRegionalQuote';

type Variant = { id: number; method: string; units: number; price: number | null; name: string };
type Catalog = { data: { id: number; slug: string; variants: Variant[]; checkoutEnabled: boolean }[]; location: { region: Region | null }; paymentMethods: PaymentMethod[] };
const panel = 'rounded-3xl border-2 border-pink-200 bg-white/95 p-5 sm:p-8 shadow-xl';
const input = 'mt-2 w-full min-w-0 rounded-xl border-2 border-pink-200 bg-pink-50/40 p-3 text-neutral-900 focus:outline-2 focus:outline-pink-800';
const button = 'rounded-xl bg-pink-800 px-6 py-3 font-bold text-white hover:bg-pink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-800 disabled:opacity-50';
const driftCodes = ['PRICE_CHANGED', 'REGION_CHANGED', 'REGION_UNVERIFIED', 'PRODUCT_UNAVAILABLE', 'REGIONAL_PRICE_UNAVAILABLE', 'PAYMENT_REGION_UNAVAILABLE'];

export default function LoginFlow({ slug, stage }: { slug: string; stage: 'packages' | 'account' | 'summary' }) {
  const { t, language } = useLanguage(); const l = t.loginFlow;
  const { draft, setDraft, checkout, busy, initialize, openPackage, confirm: submitCheckout, recover } = useLoginDraft();
  const invoice = checkout.attempt?.outcome === 'COMMITTED' ? checkout.attempt.invoice : null;
  const router = useRouter(); const base = `/roblox/${encodeURIComponent(slug)}`;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState(false); const [refresh, setRefresh] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({ username: false, email: false, whatsapp: false });
  const region = catalog?.location.region ?? null;
  const product = catalog?.data.find(p => p.slug === slug);
  const variants = product?.variants.filter(v => v.method === 'LOGIN') ?? [];
  const variant = variants.find(v => v.id === draft.variantId);
  const validAccount = !Object.values(validateLoginAccount(draft.account)).some(Boolean);
  const payment = catalog?.paymentMethods.find(m => m.id === draft.paymentMethod) ?? catalog?.paymentMethods[0];
  const eligible = Boolean(product?.checkoutEnabled && region && variant && variant.price !== null);
  const quote = useRegionalQuote(stage === 'summary' && eligible && validAccount && checkout.phase === 'READY' ? product?.id : undefined, variant?.id, region, payment?.id ?? '', undefined, checkout.revision);
  useEffect(() => { if (product) void initialize(product.id); }, [product, initialize]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products?type=ROBLOX&slug=${encodeURIComponent(slug)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error(); const data = await response.json(); if (!data.success) throw new Error(); return data as Catalog; })
      .then(data => { if (!controller.signal.aborted) { setCatalog(data); setLoadError(false); } })
      .catch(() => { if (!controller.signal.aborted) { setCatalog(null); setLoadError(true); } });
    return () => controller.abort();
  }, [slug, stage, refresh]);
  useEffect(() => {
    if (checkout.phase === 'READY' && !invoice && stage !== 'packages' && (!checkout.attempt || !draft.variantId || (stage === 'summary' && !validAccount))) router.replace(base + '?method=LOGIN');
  }, [stage, draft.variantId, validAccount, invoice, router, base, checkout.phase, checkout.attempt]);

  const money = (price: number) => region ? formatMoney(price, REGION_CURRENCY[region], language) : l.unavailable;
  const account = draft.account;
  function updateAccount(field: keyof typeof account, value: string) {
    setDraft(old => ({ ...old, account: { ...old.account, [field]: value } }));
    setFieldErrors(old => ({ ...old, [field === 'country' ? 'whatsapp' : field]: false }));
  }
  function nextAccount(event: React.FormEvent) {
    event.preventDefault(); const errors = validateLoginAccount(account); setFieldErrors(errors);
    if (!Object.values(errors).some(Boolean) && eligible) router.push(base + '/login/summary');
  }
  async function confirm() {
    if (!eligible || !validAccount || !quote.quote || !product || !variant || !payment || busy || invoice) return;
    const targetInvoice = await submitCheckout({ productId: product.id, variantId: variant.id, customerEmail: account.email.trim(), paymentMethod: payment.id, quoteToken: quote.quote.quoteToken,
      details: { username: account.username.trim(), whatsappE164: normalizeWhatsapp(account.whatsapp, account.country || undefined) } });
    if (targetInvoice) router.push('/order/' + encodeURIComponent(targetInvoice));
  }
  async function choose(repeat = false) {
    if (!product || !draft.variantId) return;
    const row = await openPackage(product.id, draft.variantId, repeat);
    if (row?.outcome === 'NOT_COMMITTED') router.push(repeat ? base + '?method=LOGIN' : base + '/login/account');
  }

  const emptyDraft = stage !== 'packages' && (!draft.variantId || (stage === 'summary' && !validAccount));
  const names = new Intl.DisplayNames([language === 'MY' ? 'ms' : language === 'ID' ? 'id' : 'en'], { type: 'region' });
  return <StoreShell><div className="mx-auto max-w-4xl space-y-6">
    <Link href="/roblox" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} className="inline-block rounded-xl bg-white p-3 font-semibold text-pink-900">{t.commerce.backToCatalog}</Link>
    <header className={panel}><p className="font-bold text-pink-800">{t.roblox.LOGIN}</p><h1 className="mt-2 text-3xl font-black text-pink-900">{l[stage]}</h1><p className="mt-3 text-neutral-700">{l.intro}</p></header>
    <DetectedLocation region={region} loading={!catalog && !loadError} />
    {checkout.error && <p role="alert" className="rounded-xl bg-rose-100 p-4 text-rose-900">{checkout.error === 'CHECKOUT_READY' ? l.reviewReady : driftCodes.includes(checkout.error) ? l.reviewChanged : checkout.error === 'INVALID_WHATSAPP' || checkout.error === 'WHATSAPP_REQUIRED' ? l.invalidWhatsapp : checkout.error === 'ROBLOX_USER_NOT_FOUND' ? t.roblox.userMissing : l.requestFailed}</p>}
    {checkout.phase === 'CHECKING' && product && <p role="status" className={panel}>{l.checking}</p>}
    {checkout.phase === 'BLOCKED' && <div className={panel}><p role="status">{l.sessionBlocked}</p><button type="button" className={button + ' mt-4'} disabled={busy || !product} onClick={() => { if (product) void initialize(product.id, true); }}>{l.retry}</button></div>}
    {!invoice && checkout.phase === 'UNKNOWN' && <div className={panel}><p role="status">{l.recoveryPending}</p><button type="button" className={`${button} mt-4`} disabled={busy} onClick={() => void recover()}>{busy ? l.processing : l.recover}</button></div>}
    {invoice ? <div className={panel}><p role="status">{l.navigating}</p><Link className={`${button} mt-4 inline-block`} href={`/order/${encodeURIComponent(invoice)}`}>{l.openInvoice}</Link><button className={`${button} ml-3 mt-4`} disabled={busy} onClick={() => void choose(true)}>{l.buyAgain}</button></div> : (checkout.phase !== 'READY' && product) || checkout.phase === 'UNKNOWN' || checkout.phase === 'BLOCKED' ? null : checkout.attempt && ['EXPIRED', 'CANCELLED'].includes(checkout.attempt.outcome) ? <div className={panel}><p role="status">{l.attemptEnded}</p><button className={`${button} mt-4`} disabled={busy} onClick={() => void choose(true)}>{l.buyAgain}</button></div> : emptyDraft ? <p role="status" className={panel}>{l.draftMissing}</p> : loadError ? <div role="alert" className={panel}>{l.catalogError} <button className={button} onClick={() => setRefresh(n => n + 1)}>{l.retry}</button></div> : !catalog ? <p role="status" className={panel}>{t.loadingCatalog}</p> : stage === 'packages' ? <section className={panel}>
      {(!variants.some(v => v.price !== null) || !region) && <p role="status" className="mb-4 text-neutral-700">{t.roblox.noPackages}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">{variants.map(v => <label key={v.id} className={`min-w-0 rounded-2xl border-2 p-4 focus-within:outline-2 focus-within:outline-pink-800 ${v.id === draft.variantId ? 'border-pink-800 bg-pink-100 ring-2 ring-pink-800' : 'border-pink-200 bg-pink-50'} ${v.price === null || !region ? 'opacity-60' : 'cursor-pointer'}`}>
        <input type="radio" name="package" className="sr-only" value={v.id} checked={v.id === draft.variantId} disabled={busy || v.price === null || !region || (checkout.attempt?.selectionLocked && v.id !== checkout.attempt.variantId)} onChange={() => setDraft(old => ({ ...old, variantId: v.id }))} />
        <span className="block text-xl font-black text-pink-900">{v.units} Robux</span><span className="mt-2 block break-words text-sm text-neutral-700">{v.name}</span><strong className="mt-3 block break-words text-pink-900">{v.price === null ? l.unavailable : money(v.price)}</strong>
      </label>)}</div>
      <button className={`${button} mt-6`} disabled={!eligible || busy || checkout.phase !== 'READY'} onClick={() => void choose()}>{l.continue}</button>
      {!product?.checkoutEnabled && <p role="status" className="mt-4 text-rose-800">{l.paymentUnavailable}</p>}
    </section> : !variant || variant.price === null || !region ? <div className={panel}><p role="status">{t.regional.unavailable}</p><Link href={base + '?method=LOGIN'} className={`${button} mt-4 inline-block`}>{l.back}</Link></div> : stage === 'account' ? <form className={`${panel} space-y-5`} onSubmit={nextAccount} noValidate>
      <p className="rounded-2xl border border-pink-300 bg-pink-50 p-4 text-pink-900">{l.privacy}</p>
      <label className="block font-semibold text-neutral-800">{l.username}<input name="username" className={input} value={account.username} onChange={e => updateAccount('username', e.target.value)} maxLength={20} autoComplete="off" autoCapitalize="none" aria-invalid={fieldErrors.username} aria-describedby="login-username-error" /></label>
      {fieldErrors.username && <p id="login-username-error" role="alert" className="text-rose-800">{l.invalidUsername}</p>}
      <div className="grid gap-4 sm:grid-cols-2"><label className="block min-w-0 font-semibold text-neutral-800">{l.country}<select name="phoneCountry" className={input} value={account.country} onChange={e => updateAccount('country', e.target.value as CountryCode)} aria-invalid={fieldErrors.whatsapp}><option value="">{l.chooseCountry}</option>{getCountries().map(country => <option key={country} value={country}>{names.of(country)} (+{getCountryCallingCode(country)})</option>)}</select></label>
      <label className="block min-w-0 font-semibold text-neutral-800">{l.whatsapp}<input name="whatsapp" className={input} type="tel" inputMode="tel" autoComplete="tel" maxLength={64} value={account.whatsapp} onChange={e => updateAccount('whatsapp', e.target.value)} aria-invalid={fieldErrors.whatsapp} aria-describedby="login-phone-help login-phone-error" /></label></div>
      <p id="login-phone-help" className="text-sm text-neutral-700">{l.phoneHelp}</p>{fieldErrors.whatsapp && <p id="login-phone-error" role="alert" className="text-rose-800">{l.invalidWhatsapp}</p>}
      <label className="block font-semibold text-neutral-800">{l.email}<input name="email" className={input} type="email" autoComplete="email" maxLength={150} value={account.email} onChange={e => updateAccount('email', e.target.value)} aria-invalid={fieldErrors.email} aria-describedby="login-email-error" /></label>{fieldErrors.email && <p id="login-email-error" role="alert" className="text-rose-800">{l.invalidEmail}</p>}
      <p className="text-sm text-neutral-600">{l.contactPurpose}</p><div className="flex flex-wrap gap-3"><Link href={base + '?method=LOGIN'} className="rounded-xl border-2 border-pink-300 px-6 py-3 font-bold text-pink-900">{l.back}</Link><button type="submit" className={button} disabled={!eligible}>{l.continue}</button></div>
    </form> : <section className={`${panel} space-y-5`}>
      <dl className="space-y-3 text-neutral-700">{[[l.method, t.roblox.LOGIN], [l.amount, `${variant.units} Robux`], [l.username, account.username], [l.whatsapp, normalizeWhatsapp(account.whatsapp, account.country || undefined)], [l.email, account.email]].map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="break-all text-right font-bold text-neutral-900">{value}</dd></div>)}</dl>
      {catalog.paymentMethods.length ? <label className="block font-semibold text-neutral-800">{t.regional.paymentMethod}<select className={input} value={payment?.id ?? ''} disabled={busy} onChange={e => setDraft(old => ({ ...old, paymentMethod: e.target.value }))}>{catalog.paymentMethods.map(m => <option value={m.id} key={m.id}>{m.label}</option>)}</select></label> : <p role="status" className="text-rose-800">{l.paymentUnavailable}</p>}
      <RegionalPaymentSummary region={region} quote={quote.quote} />
      {quote.loading && <p role="status">{t.regional.quoteLoading}</p>}
      {quote.error && <p role="alert" className="text-rose-800">{t.regional.quoteError} <button className="underline" onClick={() => { quote.retry(); setCatalog(null); setRefresh(n => n + 1); }}>{l.retry}</button></p>}
      <div className="flex flex-wrap gap-3"><button className="rounded-xl border-2 border-pink-300 px-6 py-3 font-bold text-pink-900" disabled={busy} onClick={() => router.push(base + '/login/account')}>{l.back}</button><button type="button" className={button} disabled={busy || checkout.phase !== 'READY' || checkout.attempt?.outcome !== 'NOT_COMMITTED' || !eligible || !quote.quote} onClick={() => void confirm()}>{busy ? l.processing : l.confirm}</button></div>
    </section>}
  </div></StoreShell>;
}
