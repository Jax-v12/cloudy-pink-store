'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { useLoginDraft } from '@/context/LoginDraftContext';
import { ASEAN_PHONE_COUNTRIES, getCountries, getCountryCallingCode, normalizeWhatsapp, validateLoginAccount, type CountryCode } from '@/lib/loginContact';
import { formatMoney, REGION_CURRENCY, type Region } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';
import StoreShell from './StoreShell';
import DetectedLocation from './DetectedLocation';
import RegionalPaymentSummary from './RegionalPaymentSummary';
import { useRegionalQuote } from './useRegionalQuote';
import LoginUsernameField from './LoginUsernameField';

type Variant = { id: number; method: string; units: number; price: number | null; name: string };
type Catalog = {
  data: { id: number; slug: string; variants: Variant[]; checkoutEnabled: boolean }[];
  location: { region: Region | null };
  paymentMethods: PaymentMethod[];
};

const panel = 'rounded-3xl border border-[#F1E4ED] bg-white p-5 sm:p-8 shadow-[0_14px_36px_-12px_rgba(157,23,77,0.09)]';
const input =
  'mt-2 w-full min-w-0 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-3 text-[#251D2C] font-medium focus:border-pink-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all';
const button =
  'rounded-xl bg-pink-600 px-6 py-3 font-extrabold text-white shadow-sm shadow-pink-600/20 hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 disabled:opacity-50 transition cursor-pointer';
const driftCodes = [
  'PRICE_CHANGED',
  'REGION_CHANGED',
  'REGION_UNVERIFIED',
  'PRODUCT_UNAVAILABLE',
  'REGIONAL_PRICE_UNAVAILABLE',
  'PAYMENT_REGION_UNAVAILABLE',
];

export default function LoginFlow({ slug, stage }: { slug: string; stage: 'packages' | 'account' | 'summary' }) {
  const { t, language } = useLanguage();
  const l = t.loginFlow;
  const { draft, setDraft, checkout, busy, initialize, openPackage, confirm: submitCheckout, recover } = useLoginDraft();
  const invoice = checkout.attempt?.outcome === 'COMMITTED' ? checkout.attempt.invoice : null;
  const router = useRouter();
  const base = `/roblox/${encodeURIComponent(slug)}`;
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({ username: false, email: false, whatsapp: false, password: false, backupCodes: false });
  const [showPassword, setShowPassword] = useState(false);
  const region = catalog?.location.region ?? null;
  const product = catalog?.data.find(p => p.slug === slug);
  const variants = product?.variants.filter(v => v.method === 'LOGIN') ?? [];
  const variant = variants.find(v => v.id === draft.variantId);
  const validAccount = !Object.values(validateLoginAccount(draft.account)).some(Boolean);
  const payment = catalog?.paymentMethods.find(m => m.id === draft.paymentMethod) ?? catalog?.paymentMethods[0];
  const eligible = Boolean(product?.checkoutEnabled && region && variant && variant.price !== null);
  const quote = useRegionalQuote(
    stage === 'summary' && eligible && validAccount && checkout.phase === 'READY' ? product?.id : undefined,
    variant?.id,
    region,
    payment?.id ?? '',
    undefined,
    checkout.revision
  );

  useEffect(() => {
    if (product) void initialize(product.id);
  }, [product, initialize]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/products?type=ROBLOX&slug=${encodeURIComponent(slug)}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!data.success) throw new Error();
        return data as Catalog;
      })
      .then(data => {
        if (!controller.signal.aborted) {
          setCatalog(data);
          setLoadError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setCatalog(null);
          setLoadError(true);
        }
      });
    return () => controller.abort();
  }, [slug, stage, refresh]);

  useEffect(() => {
    if (
      checkout.phase === 'READY' &&
      !invoice &&
      stage !== 'packages' &&
      (!checkout.attempt || !draft.variantId || (stage === 'summary' && !validAccount))
    )
      router.replace(base + '?method=LOGIN');
  }, [stage, draft.variantId, validAccount, invoice, router, base, checkout.phase, checkout.attempt]);

  const money = (price: number) => (region ? formatMoney(price, REGION_CURRENCY[region], language) : l.unavailable);
  const account = draft.account;

  function updateAccount(field: Exclude<keyof typeof account, 'backupCodes'>, value: string) {
    setDraft(old => ({ ...old, account: { ...old.account, [field]: value } }));
    setFieldErrors(old => ({ ...old, [field === 'country' ? 'whatsapp' : field]: false }));
  }
  function updateBackupCode(index: number, value: string) {
    setDraft(old => ({
      ...old,
      account: { ...old.account, backupCodes: old.account.backupCodes.map((code, i) => (i === index ? value : code)) },
    }));
    setFieldErrors(old => ({ ...old, backupCodes: false }));
  }
  function nextAccount(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateLoginAccount(account);
    setFieldErrors(errors);
    if (!Object.values(errors).some(Boolean) && eligible) router.push(base + '/login/summary');
  }
  async function confirm() {
    if (!eligible || !validAccount || !quote.quote || !product || !variant || !payment || busy || invoice) return;
    const targetInvoice = await submitCheckout({
      productId: product.id,
      variantId: variant.id,
      customerEmail: account.email.trim(),
      paymentMethod: payment.id,
      quoteToken: quote.quote.quoteToken,
      details: {
        username: account.username.trim(),
        whatsappE164: normalizeWhatsapp(account.whatsapp, account.country || undefined),
        password: account.password,
        backupCodes: account.backupCodes,
      },
    });
    if (targetInvoice) router.push('/order/' + encodeURIComponent(targetInvoice));
  }
  async function choose(repeat = false) {
    if (!product || !draft.variantId) return;
    const row = await openPackage(product.id, draft.variantId, repeat);
    if (row?.outcome === 'NOT_COMMITTED') router.push(repeat ? base + '?method=LOGIN' : base + '/login/account');
  }

  const emptyDraft = stage !== 'packages' && (!draft.variantId || (stage === 'summary' && !validAccount));
  const names = new Intl.DisplayNames([language === 'MY' ? 'ms' : language === 'ID' ? 'id' : 'en'], { type: 'region' });
  const hasPhoneFlag = account.country !== '' && ASEAN_PHONE_COUNTRIES.includes(account.country);

  return (
    <StoreShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <Link
          href="/roblox"
          aria-disabled={busy}
          onClick={event => {
            if (busy) event.preventDefault();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-[#F1E4ED] bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-[#251D2C] shadow-2xs hover:border-pink-300 hover:bg-pink-50/60 hover:text-pink-700 transition"
        >
          &larr; {t.commerce.backToCatalog}
        </Link>

        <header className={panel}>
          <span className="inline-block rounded-lg border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-pink-700">
            {t.roblox.LOGIN}
          </span>
          <h1 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#251D2C]">{l[stage]}</h1>
          <p className="mt-2 text-sm sm:text-base text-[#756C7D]">
            {stage === 'account' ? l.accountIntro : stage === 'summary' ? l.summaryIntro : l.intro}
          </p>
          <ol aria-label={t.commerce.status} className="mt-5 grid grid-cols-3 gap-2 border-t border-[#F1E4ED] pt-4">
            {(['packages', 'account', 'summary'] as const).map((item, index) => {
              const activeIndex = ['packages', 'account', 'summary'].indexOf(stage);
              const current = index === activeIndex;
              const done = index < activeIndex;
              return (
                <li
                  key={item}
                  aria-current={current ? 'step' : undefined}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs sm:text-sm transition ${
                    current
                      ? 'border-pink-600 bg-pink-50/80 font-extrabold text-[#251D2C] ring-1 ring-pink-600'
                      : done
                        ? 'border-pink-200 bg-[#FFF9FC] font-bold text-pink-800'
                        : 'border-[#F1E4ED] bg-white text-[#756C7D]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                      current ? 'bg-pink-600 text-white' : done ? 'bg-pink-200 text-pink-800' : 'bg-[#F1E4ED] text-[#756C7D]'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  <span className="min-w-0 break-words leading-tight">{l[item]}</span>
                </li>
              );
            })}
          </ol>
        </header>

        <DetectedLocation region={region} loading={!catalog && !loadError} />

        {checkout.error && (
          <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">
            {checkout.error === 'CHECKOUT_READY'
              ? l.reviewReady
              : driftCodes.includes(checkout.error)
                ? l.reviewChanged
                : checkout.error === 'INVALID_WHATSAPP' || checkout.error === 'WHATSAPP_REQUIRED'
                  ? l.invalidWhatsapp
                  : checkout.error === 'ROBLOX_USER_NOT_FOUND'
                    ? t.roblox.userMissing
                    : l.requestFailed}
          </p>
        )}

        {checkout.phase === 'CHECKING' && product && (
          <p role="status" className={panel}>
            {l.checking}
          </p>
        )}
        {checkout.phase === 'BLOCKED' && (
          <div className={panel}>
            <p role="status">{l.sessionBlocked}</p>
            <button
              type="button"
              className={button + ' mt-4'}
              disabled={busy || !product}
              onClick={() => {
                if (product) void initialize(product.id, true);
              }}
            >
              {l.retry}
            </button>
          </div>
        )}
        {!invoice && checkout.phase === 'UNKNOWN' && (
          <div className={panel}>
            <p role="status">{l.recoveryPending}</p>
            <button type="button" className={`${button} mt-4`} disabled={busy} onClick={() => void recover()}>
              {busy ? l.processing : l.recover}
            </button>
          </div>
        )}

        {invoice ? (
          <div className={panel}>
            <p role="status" className="font-semibold text-[#251D2C]">
              {l.navigating}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link className={`${button} inline-block`} href={`/order/${encodeURIComponent(invoice)}`}>
                {l.openInvoice}
              </Link>
              <button
                className="rounded-xl border border-[#F1E4ED] bg-white px-6 py-3 font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 transition cursor-pointer"
                disabled={busy}
                onClick={() => void choose(true)}
              >
                {l.buyAgain}
              </button>
            </div>
          </div>
        ) : (checkout.phase !== 'READY' && product) || checkout.phase === 'UNKNOWN' || checkout.phase === 'BLOCKED' ? null : checkout.attempt &&
          ['EXPIRED', 'CANCELLED'].includes(checkout.attempt.outcome) ? (
          <div className={panel}>
            <p role="status">{l.attemptEnded}</p>
            <button className={`${button} mt-4`} disabled={busy} onClick={() => void choose(true)}>
              {l.buyAgain}
            </button>
          </div>
        ) : emptyDraft ? (
          <p role="status" className={panel}>
            {l.draftMissing}
          </p>
        ) : loadError ? (
          <div role="alert" className={panel}>
            {l.catalogError}{' '}
            <button className={button} onClick={() => setRefresh(n => n + 1)}>
              {l.retry}
            </button>
          </div>
        ) : !catalog ? (
          <p role="status" className={panel}>
            {t.loadingCatalog}
          </p>
        ) : stage === 'packages' ? (
          <section className={panel}>
            {(!variants.some(v => v.price !== null) || !region) && (
              <p role="status" className="mb-4 text-sm font-medium text-[#756C7D]">
                {t.roblox.noPackages}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3">
              {variants.map(v => (
                <label
                  key={v.id}
                  className={`min-w-0 rounded-2xl border p-4 sm:p-5 transition focus-within:outline-2 focus-within:outline-pink-700 ${
                    v.id === draft.variantId
                      ? 'border-pink-600 bg-pink-50/70 ring-1 ring-pink-600 shadow-xs'
                      : 'border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300'
                  } ${v.price === null || !region ? 'opacity-60' : 'cursor-pointer'}`}
                >
                  <input
                    type="radio"
                    name="package"
                    className="sr-only"
                    value={v.id}
                    checked={v.id === draft.variantId}
                    disabled={busy || v.price === null || !region || (checkout.attempt?.selectionLocked && v.id !== checkout.attempt.variantId)}
                    onChange={() => setDraft(old => ({ ...old, variantId: v.id }))}
                  />
                  <span className="block text-xl font-extrabold text-[#251D2C]">{v.units} Robux</span>
                  <span className="mt-1.5 block break-words text-xs sm:text-sm font-medium text-[#756C7D]">{v.name}</span>
                  <strong className="mt-3 block break-words text-base sm:text-lg font-extrabold text-pink-600">
                    {v.price === null ? l.unavailable : money(v.price)}
                  </strong>
                </label>
              ))}
            </div>
            <button className={`${button} mt-6`} disabled={!eligible || busy || checkout.phase !== 'READY'} onClick={() => void choose()}>
              {l.continue}
            </button>
            {!product?.checkoutEnabled && (
              <p role="status" className="mt-4 text-sm font-semibold text-rose-800">
                {l.paymentUnavailable}
              </p>
            )}
          </section>
        ) : !variant || variant.price === null || !region ? (
          <div className={panel}>
            <p role="status">{t.regional.unavailable}</p>
            <Link href={base + '?method=LOGIN'} className={`${button} mt-4 inline-block`}>
              {l.back}
            </Link>
          </div>
        ) : stage === 'account' ? (
          <form className={`${panel} space-y-5`} onSubmit={nextAccount} autoComplete="off" noValidate>
            <p className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4 text-sm font-medium text-[#251D2C]">{l.privacy}</p>
            <LoginUsernameField
              value={account.username}
              onChange={value => updateAccount('username', value)}
              invalid={fieldErrors.username}
              className={input}
            />
            <div>
              <label htmlFor="login-password" className="block text-sm font-bold text-[#251D2C]">
                {l.password}
              </label>
              <div className="flex items-start gap-2">
                <input
                  id="login-password"
                  name="robloxPassword"
                  className={input}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  maxLength={1024}
                  value={account.password}
                  onChange={e => updateAccount('password', e.target.value)}
                  aria-invalid={fieldErrors.password}
                  aria-describedby="login-password-error"
                />
                <button
                  type="button"
                  className="mt-2 shrink-0 rounded-2xl border border-[#F1E4ED] bg-white px-4 py-3 text-sm font-bold text-pink-700 hover:border-pink-300 hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-pink-600 transition cursor-pointer"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(value => !value)}
                >
                  {showPassword ? l.hide : l.show}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="login-password-error" role="alert" className="mt-2 text-sm font-semibold text-rose-700">
                  {l.invalidPassword}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label htmlFor="login-whatsapp" className="block text-sm font-bold text-[#251D2C]">
                  {l.whatsapp}
                </label>
                <div className="mt-2 flex rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] focus-within:border-pink-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-pink-500/10 transition-all">
                  <div className="relative flex w-28 shrink-0 items-center justify-center border-r border-[#F1E4ED]">
                    <span aria-hidden="true" className="pointer-events-none flex min-w-0 items-center gap-2 px-2 text-sm font-bold text-[#251D2C]">
                      {hasPhoneFlag && (
                        <Image
                          data-phone-flag
                          src={`/flags/${account.country.toLowerCase()}.svg`}
                          alt=""
                          width={24}
                          height={18}
                          unoptimized
                          className="shrink-0 rounded-xs ring-1 ring-black/10"
                        />
                      )}
                      <span className="truncate">{account.country ? `+${getCountryCallingCode(account.country)}` : l.chooseCountry}</span>
                      <svg className="h-3 w-3 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">
                        <path d="m3 6 5 5 5-5" />
                      </svg>
                    </span>
                    <label htmlFor="login-phone-country" className="sr-only">
                      {l.country}
                    </label>
                    <select
                      id="login-phone-country"
                      name="phoneCountry"
                      className="absolute inset-0 h-full w-full cursor-pointer rounded-l-2xl opacity-0"
                      value={account.country}
                      onChange={e => updateAccount('country', e.target.value as CountryCode)}
                      aria-invalid={fieldErrors.whatsapp}
                      aria-describedby="login-phone-help login-phone-error"
                    >
                      <option value="">{l.chooseCountry}</option>
                      <optgroup label={l.aseanCountries}>
                        {ASEAN_PHONE_COUNTRIES.map(country => (
                          <option key={country} value={country}>
                            {names.of(country)} (+{getCountryCallingCode(country)})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={l.otherCountries}>
                        {getCountries()
                          .filter(country => !ASEAN_PHONE_COUNTRIES.includes(country))
                          .map(country => (
                            <option key={country} value={country}>
                              {names.of(country)} (+{getCountryCallingCode(country)})
                            </option>
                          ))}
                      </optgroup>
                    </select>
                  </div>
                  <input
                    id="login-whatsapp"
                    name="whatsapp"
                    className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-3 py-3 text-[#251D2C] font-medium outline-none"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    maxLength={64}
                    value={account.whatsapp}
                    onChange={e => updateAccount('whatsapp', e.target.value)}
                    aria-invalid={fieldErrors.whatsapp}
                    aria-describedby="login-phone-help login-phone-error"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-sm font-bold text-[#251D2C]">
                  {l.email}
                  <input
                    name="email"
                    className={input}
                    type="email"
                    autoComplete="email"
                    maxLength={150}
                    value={account.email}
                    onChange={e => updateAccount('email', e.target.value)}
                    aria-invalid={fieldErrors.email}
                    aria-describedby="login-email-error"
                  />
                </label>
                {fieldErrors.email && (
                  <p id="login-email-error" role="alert" className="mt-1.5 text-sm font-semibold text-rose-700">
                    {l.invalidEmail}
                  </p>
                )}
              </div>
            </div>
            <p id="login-phone-help" className="text-xs sm:text-sm text-[#756C7D]">
              {l.phoneHelp}
            </p>
            {fieldErrors.whatsapp && (
              <p id="login-phone-error" role="alert" className="text-sm font-semibold text-rose-700">
                {l.invalidWhatsapp}
              </p>
            )}

            <fieldset className="space-y-3 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC]/60 p-4 sm:p-5">
              <legend className="px-1 font-extrabold text-[#251D2C]">{l.backupTitle}</legend>
              <details className="rounded-2xl border border-[#F1E4ED] bg-white p-3.5 text-sm text-[#251D2C]">
                <summary className="cursor-pointer font-bold text-pink-700 focus-visible:outline-2 focus-visible:outline-pink-800">
                  {l.backupGuideTitle}
                </summary>
                <ol className="mt-2.5 list-decimal space-y-1.5 pl-5 text-[#756C7D]">
                  {l.backupGuideSteps.map(step => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </details>
              <div className="grid gap-3 sm:grid-cols-2">
                {account.backupCodes.map((code, index) => (
                  <label key={index} className="block text-sm font-bold text-[#251D2C]">
                    {l.backupCode} {index + 1}
                    <input
                      name={`backupCode${index + 1}`}
                      type="password"
                      className={`${input} bg-white font-mono`}
                      autoComplete="off"
                      spellCheck={false}
                      autoCapitalize="none"
                      maxLength={64}
                      value={code}
                      onChange={e => updateBackupCode(index, e.target.value)}
                      aria-invalid={fieldErrors.backupCodes}
                      aria-describedby="login-backup-help login-backup-error"
                    />
                  </label>
                ))}
              </div>
              <p id="login-backup-help" className="text-xs sm:text-sm text-[#756C7D]">
                {l.backupHelp}
              </p>
              {fieldErrors.backupCodes && (
                <p id="login-backup-error" role="alert" className="text-sm font-semibold text-rose-700">
                  {l.invalidBackupCodes}
                </p>
              )}
            </fieldset>

            <p className="text-xs sm:text-sm text-[#756C7D]">{l.contactPurpose}</p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={base + '?method=LOGIN'}
                className="rounded-xl border border-[#F1E4ED] bg-white px-6 py-3 font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 transition"
              >
                {l.back}
              </Link>
              <button type="submit" className={button} disabled={!eligible}>
                {l.continue}
              </button>
            </div>
          </form>
        ) : (
          <section className={`${panel} space-y-5`}>
            <p className="rounded-2xl border border-pink-200 bg-pink-50/80 p-4 text-sm font-medium text-[#251D2C]">{l.accessSummary}</p>
            <dl className="divide-y divide-[#F1E4ED] rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-2 text-sm text-[#756C7D]">
              {[
                [l.method, t.roblox.LOGIN],
                [l.amount, `${variant.units} Robux`],
                [l.username, account.username],
                [l.whatsapp, normalizeWhatsapp(account.whatsapp, account.country || undefined)],
                [l.email, account.email],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 py-3">
                  <dt className="font-medium">{label}</dt>
                  <dd className="break-all text-right font-bold text-[#251D2C]">{value}</dd>
                </div>
              ))}
            </dl>
            {catalog.paymentMethods.length ? (
              <label className="block text-sm font-bold text-[#251D2C]">
                {t.regional.paymentMethod}
                <select
                  className={input}
                  value={payment?.id ?? ''}
                  disabled={busy}
                  onChange={e => setDraft(old => ({ ...old, paymentMethod: e.target.value }))}
                >
                  {catalog.paymentMethods.map(m => (
                    <option value={m.id} key={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p role="status" className="text-sm font-semibold text-rose-800">
                {l.paymentUnavailable}
              </p>
            )}
            <RegionalPaymentSummary region={region} quote={quote.quote} />
            {quote.loading && (
              <p role="status" className="text-sm text-[#756C7D]">
                {t.regional.quoteLoading}
              </p>
            )}
            {quote.error && (
              <p role="alert" className="text-sm font-semibold text-rose-800">
                {t.regional.quoteError}{' '}
                <button
                  className="underline font-bold"
                  onClick={() => {
                    quote.retry();
                    setCatalog(null);
                    setRefresh(n => n + 1);
                  }}
                >
                  {l.retry}
                </button>
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-xl border border-[#F1E4ED] bg-white px-6 py-3 font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 transition cursor-pointer"
                disabled={busy}
                onClick={() => router.push(base + '/login/account')}
              >
                {l.back}
              </button>
              <button
                type="button"
                className={button}
                disabled={busy || checkout.phase !== 'READY' || checkout.attempt?.outcome !== 'NOT_COMMITTED' || !eligible || !quote.quote}
                onClick={() => void confirm()}
              >
                {busy ? l.processing : l.confirm}
              </button>
            </div>
          </section>
        )}
      </div>
    </StoreShell>
  );
}
