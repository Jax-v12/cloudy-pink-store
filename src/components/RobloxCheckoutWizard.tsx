'use client';
import { observeCheckout } from './AggregateMetrics';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '@/context/LanguageContext';
import { fillTemplate, robloxGamepassPrice } from '@/lib/roblox';
import { quoteRegionalQuantity, regionalAmount, formatMoney, REGION_CURRENCY, type RegionalRate, type Region } from '@/lib/regionalPricing';
import type { PaymentMethod } from '@/lib/paymentProvider';
import RegionalPaymentSummary from './RegionalPaymentSummary';
import { useRegionalQuote } from './useRegionalQuote';
import RobloxFields from './RobloxFields';
import RobuxIcon from './RobuxIcon';
import RobloxGamepassGuide from './RobloxGamepassGuide';
import CheckoutSteps from './CheckoutSteps';

type Rate = {
  id: number;
  name: string;
  price: number | null;
  units: number;
  maxUnits?: number | null;
  unitStep?: number;
  regionalPrices?: { region: string; amount: number; active: boolean }[];
};

export default function RobloxCheckoutWizard({
  method,
  productId,
  variants,
  enabled,
  onBusyChange,
  region,
  methods,
  onRegionRefresh,
}: {
  onRegionRefresh: () => void;
  region: Region;
  methods: PaymentMethod[];
  method: 'GAMEPASS' | 'GIFT_USERNAME';
  productId: number;
  variants: Rate[];
  enabled: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t, language } = useLanguage();
  const f = t.robloxFlow;
  const r = t.roblox;
  const c = t.commerce;
  const u = t.usernameFlow;
  const viaUsername = method === 'GIFT_USERNAME';
  const router = useRouter();
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(0);
  const [step, setStep] = useState(0);
  const phase = viaUsername && step >= 2 ? step + 1 : step;
  const finalStep = viaUsername ? 3 : 4;
  const [rateId, setRateId] = useState(variants[0]?.id);
  const rate = variants.find(v => v.id === rateId) ?? variants[0];
  const [quantityText, setQuantityText] = useState(String(rate?.units ?? 50));
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [link, setLink] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const retry = useRef({ payload: '', key: '' });
  const submitting = useRef(false);

  useEffect(() => {
    if (step !== previousStep.current) heading.current?.focus();
    previousStep.current = step;
  }, [step]);

  const money = (n: number) => formatMoney(n, REGION_CURRENCY[region], language);
  const [methodId, setMethodId] = useState('');
  const selectedMethod = methods.find(m => m.id === methodId) ?? methods[0];
  const methodValue = selectedMethod?.id ?? '';
  const server = useRegionalQuote(productId, rate?.id, region, methodValue, Number(quantityText));
  const basePrice = rate && rate.price !== null ? regionalAmount(rate as RegionalRate, region) : null;
  let quote: ReturnType<typeof quoteRegionalQuantity> | null = null;
  try {
    if (rate && rate.price !== null) quote = quoteRegionalQuantity(rate as RegionalRate, region, Number(quantityText));
  } catch {
    /* Display validation next to the editable amount. */
  }
  const units = quote?.units ?? rate?.units ?? 50;
  const price = robloxGamepassPrice(units);
  const steps = viaUsername
    ? [u.infoStep, f.detailsStep, f.paymentStep, f.confirmStep]
    : [f.orderStep, f.detailsStep, f.passStep, f.paymentStep, f.confirmStep];
  const titles = viaUsername
    ? [u.title, f.detailsTitle, f.paymentTitle, f.confirmTitle]
    : [f.title, f.detailsTitle, f.passTitle, f.paymentTitle, f.confirmTitle];
  const intros = viaUsername
    ? [u.description, u.detailsIntro, f.paymentIntro, u.confirmIntro]
    : [f.description, f.detailsIntro, f.passIntro, f.paymentIntro, f.confirmIntro];
  const input =
    'w-full rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-3.5 text-[#251D2C] font-medium outline-none focus:border-pink-500 focus:bg-white focus:ring-4 focus:ring-pink-500/10 transition-all';
  const errors: Record<string, string> = {
    REGION_UNVERIFIED: t.regional.locationUnavailable,
    REGION_CHANGED: t.regional.priceChanged,
    PRICE_CHANGED: t.regional.priceChanged,
    REGIONAL_PRICE_UNAVAILABLE: t.regional.unavailable,
    PAYMENT_REGION_UNAVAILABLE: t.regional.paymentUnavailable,
    PAYMENT_METHOD_UNAVAILABLE: t.regional.paymentUnavailable,
    INVALID_INPUT: t.errIncompleteData,
    IDEMPOTENCY_CONFLICT: c.conflict,
    PRODUCT_UNAVAILABLE: c.checkoutUnavailable,
    CAPACITY_REVIEW_REQUIRED: c.checkoutUnavailable,
    ROBLOX_USER_NOT_FOUND: r.userMissing,
    GAMEPASS_NOT_FOUND: r.gamepassMissing,
    GAMEPASS_OWNER_MISMATCH: r.ownerMismatch,
    GAMEPASS_NOT_FOR_SALE: r.notForSale,
    GAMEPASS_PRICE_MISMATCH: r.wrongPrice,
    RATE_LIMIT_EXCEEDED: t.rateLimited,
  };

  function go(next: number) {
    setError('');
    setStep(next);
  }
  function amount(value: string) {
    setQuantityText(value);
    setLink('');
    retry.current = { payload: '', key: '' };
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rate || busy || submitting.current) return;
    // The introduction has no amount field; let buyers return to the editable details step.
    if (step === 0) {
      go(1);
      return;
    }
    if (!quote) {
      setError(f.quantityError);
      return;
    }
    if (phase === 2) {
      try {
        const url = new URL(link.trim());
        if (
          url.protocol !== 'https:' ||
          !['www.roblox.com', 'roblox.com'].includes(url.hostname) ||
          url.port ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          !/^\/game-pass\/\d+(?:\/[^/?#]*)?\/?$/.test(url.pathname)
        )
          throw new Error();
      } catch {
        setError(r.gamepassMissing);
        return;
      }
    }
    if (step < finalStep) {
      go(step + 1);
      return;
    }
    if (!enabled || !server.quote || !selectedMethod) return;
    const payload = JSON.stringify({
      quoteToken: server.quote.quoteToken,
      paymentMethod: methodValue,
      productId,
      variantId: rate.id,
      quantity: quote.units,
      customerEmail: email.trim(),
      details: { username: username.trim(), ...(!viaUsername ? { gamepassUrl: link.trim() } : {}) },
    });
    if (retry.current.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    observeCheckout(method);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'idempotency-key': retry.current.key },
        body: payload,
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.errorCode);
      localStorage.setItem(`token_${json.data.invoice}`, json.data.accessToken);
      router.push(`/order/${encodeURIComponent(json.data.invoice)}`);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(errors[code] || t.errSystem);
      if (['PRICE_CHANGED', 'REGION_UNVERIFIED', 'PAYMENT_REGION_UNAVAILABLE'].includes(code)) {
        server.retry();
        onRegionRefresh();
      }
    } finally {
      submitting.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  if (!rate)
    return (
      <p className="rounded-3xl border border-[#F1E4ED] bg-white p-8 text-center font-semibold text-[var(--text-secondary)]">
        {r.noPackages}
      </p>
    );
  const maximum = rate.maxUnits ?? rate.units;
  const increment = rate.unitStep ?? 1;
  const progress = maximum === rate.units ? 0 : ((units - rate.units) / (maximum - rate.units)) * 100;

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <CheckoutSteps labels={steps} current={step} ariaLabel={c.status} busy={busy} onStepChange={go} />

      <form
        onSubmit={submit}
        className="mt-6 rounded-3xl border border-[#F1E4ED] bg-white px-5 py-6 sm:mt-8 sm:p-8"
      >
        <fieldset key={step} disabled={busy} className="store-step min-w-0">
          <header className="mx-auto mb-7 max-w-xl text-center">
            <h2 ref={heading} tabIndex={-1} className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#251D2C] outline-none">
              {titles[step]}
            </h2>
            <p className="mt-2.5 text-sm sm:text-base leading-relaxed text-[var(--text-secondary)]">{intros[step]}</p>
          </header>

          {error && (
            <p role="alert" className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 text-rose-800 p-4 text-sm font-semibold">
              {error}
            </p>
          )}

          {step === 0 && (
            <div className="mx-auto max-w-lg space-y-4">
              {variants.length > 1 && (
                <label className="block text-sm font-bold text-[#251D2C]">
                  {f.rate}
                  <select
                    value={rate.id}
                    onChange={e => {
                      const next = variants.find(v => v.id === Number(e.target.value))!;
                      setRateId(next.id);
                      amount(String(next.units));
                    }}
                    className={`${input} mt-2`}
                  >
                    {variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ·{' '}
                        {v.price !== null && regionalAmount(v as RegionalRate, region) !== null
                          ? money(regionalAmount(v as RegionalRate, region)!)
                          : t.regional.unavailable}{' '}
                        / {v.units} Robux
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex items-center gap-4 rounded-2xl border border-pink-200/80 bg-[#FFF9FC] p-5">
                <span
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#FFF9FC] text-[var(--text-secondary)]"
                >
                  <RobuxIcon />
                </span>
                <div>
                  <strong className="block text-2xl font-extrabold text-pink-600">
                    {basePrice === null ? t.regional.unavailable : money(basePrice)}
                  </strong>
                  <span className="mt-1 block text-sm text-[var(--text-secondary)] font-medium">{rate.units} Robux · {f.baseRate}</span>
                </div>
              </div>

              <div className="border-t border-[#F1E4ED] pt-4">
                <p className="mb-3 text-sm text-[var(--text-secondary)]">
                  {t.serviceHelp.comparison.estimateLabel}: <strong className="text-[#251D2C]">{t.serviceHelp.comparison.estimates[method]}</strong>
                  <span className="mt-1 block text-xs leading-relaxed">{t.serviceHelp.comparison.estimateNotice}</span>
                </p>
                <p className="font-extrabold text-[#251D2C]">
                  {enabled && methods.length > 0 && basePrice !== null ? f.available : c.unavailable}
                </p>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">{f.manual}</p>
              </div>

              <p className="text-xs sm:text-sm text-center text-[var(--text-secondary)]">{f.safeDraft}</p>
              {viaUsername && (
                <p className="border-l-2 border-pink-300 pl-4 text-sm leading-relaxed text-[#251D2C]">
                  {u.privacy}
                </p>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <RobloxFields
                method={method}
                units={units}
                identityOnly
                initialUsername={username}
                onUsernameChange={value => {
                  setUsername(value);
                  setLink('');
                }}
              />

              <div className="border-y border-[#F1E4ED] py-5 space-y-5">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 sm:gap-4">
                  <label className="text-sm font-bold text-[#251D2C]" htmlFor={`${id}-quantity`}>
                    {f.quantity}
                    <input
                      id={`${id}-quantity`}
                      type="number"
                      inputMode="numeric"
                      min={rate.units}
                      max={maximum}
                      step={increment}
                      value={quantityText}
                      onChange={e => amount(e.target.value)}
                      required
                      aria-describedby={`${id}-hint`}
                      className={`${input} mt-2 bg-white font-extrabold`}
                    />
                  </label>
                  <div className="text-sm font-bold text-[#251D2C]">
                    {r.total}
                    <output
                      className="mt-2 block w-full rounded-2xl border border-pink-200 bg-white px-4 py-3.5 font-extrabold text-pink-600"
                      aria-live="polite"
                    >
                      {quote ? money(quote.totalAmount) : '—'}
                    </output>
                  </div>
                </div>

                <div>
                  <label className="sr-only" htmlFor={`${id}-range`}>
                    {f.quantity}
                  </label>
                  <input
                    id={`${id}-range`}
                    type="range"
                    min={rate.units}
                    max={maximum}
                    step={increment}
                    value={units}
                    onChange={e => amount(e.target.value)}
                    aria-valuetext={`${units} Robux`}
                    aria-describedby={`${id}-hint`}
                    disabled={maximum === rate.units}
                    className="gamepass-range w-full"
                    style={{ background: `linear-gradient(to right, #EC4899 ${progress}%, #F1E4ED ${progress}%)` }}
                  />
                  <div className="mt-2 flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)]">
                    <span>{rate.units} Robux</span>
                    <span className="rounded-full border border-pink-200 bg-white px-3.5 py-1 text-xs sm:text-sm font-extrabold text-pink-700">
                      {units} Robux
                    </span>
                    <span>{maximum} Robux</span>
                  </div>
                  <p id={`${id}-hint`} className="mt-3 text-center text-xs text-[var(--text-secondary)]">
                    {fillTemplate(f.quantityHelp, { min: rate.units, max: maximum, step: increment })}
                  </p>
                  {!quote && (
                    <p role="alert" className="mt-2 text-center text-sm font-semibold text-rose-700">
                      {basePrice === null ? t.regional.unavailable : f.quantityError}
                    </p>
                  )}
                </div>
              </div>

              <label className="block text-sm font-bold text-[#251D2C]">
                {c.email}
                <input
                  type="email"
                  autoComplete="email"
                  maxLength={150}
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`${input} mt-2`}
                />
              </label>

              <div className="border-l-2 border-pink-300 pl-4">
                <h3 className="font-extrabold text-[#251D2C]">{f.noteTitle}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{viaUsername ? u.timing : f.timing}</p>
              </div>
            </div>
          )}

          {phase === 2 && (
            <div className="space-y-6">
              <div className="flex flex-wrap justify-between gap-2 border-b border-[#F1E4ED] pb-4 text-sm text-[var(--text-secondary)]">
                <p>
                  {f.recipient}: <strong className="text-[#251D2C]">@{username}</strong>
                </p>
                <p>
                  {r.netRobux}: <strong className="text-[#251D2C]">{units} Robux</strong>
                </p>
              </div>

              <div className="rounded-3xl border border-pink-200 bg-[#FFF9FC] p-6 text-center">
                <p className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-pink-700">{f.price}</p>
                <p className="my-2.5 text-4xl font-extrabold text-pink-600">
                  {price} <span className="text-xl font-bold">Robux</span>
                </p>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{fillTemplate(r.taxNotice, { price, units })}</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://create.roblox.com/dashboard/creations"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-pink-200 bg-pink-50 px-5 py-2.5 text-sm font-bold text-pink-700 hover:bg-pink-100 transition"
                >
                  {f.create} ↗
                </a>
                <RobloxGamepassGuide price={price} />
              </div>

              <label className="block text-sm font-bold text-[#251D2C]">
                {c.gamepassUrl}
                <input
                  type="url"
                  maxLength={500}
                  required
                  value={link}
                  onChange={e => setLink(e.target.value)}
                  placeholder="https://www.roblox.com/game-pass/123456789"
                  className={`${input} mt-2`}
                />
              </label>
              <p className="text-xs text-[var(--text-secondary)]">{f.linkHelp}</p>
            </div>
          )}

          {phase === 3 && (
            <div className="space-y-3">
              {methods.map(m => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-2xl border p-4 sm:p-5 transition ${
                    methodValue === m.id
                      ? 'border-pink-600 bg-pink-50/70 ring-1 ring-pink-600'
                      : 'border-[#F1E4ED] bg-[#FFF9FC] hover:border-pink-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={m.id}
                    checked={methodValue === m.id}
                    onChange={() => setMethodId(m.id)}
                    className="h-4 w-4 accent-pink-600"
                  />
                  <strong className="text-sm sm:text-base font-extrabold text-[#251D2C]">{m.label}</strong>
                </label>
              ))}
            </div>
          )}

          {phase >= 3 && (
            <div className="my-5 space-y-3">
              <RegionalPaymentSummary region={region} quote={server.quote} subtotal={quote?.totalAmount} />
              {server.loading && (
                <p role="status" className="text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
                  {t.regional.quoteLoading}
                </p>
              )}
              {server.error && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs sm:text-sm text-rose-800">
                  {errors[server.error] || t.regional.quoteError}{' '}
                  <button
                    type="button"
                    onClick={() => {
                      server.retry();
                      onRegionRefresh();
                    }}
                    className="font-bold underline"
                  >
                    {t.regional.retry}
                  </button>
                </p>
              )}
            </div>
          )}

          {!methods.length && (
            <p role="status" className="my-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {t.regional.paymentUnavailable}
            </p>
          )}

          {(phase === 4 || (viaUsername && phase === 3)) && (
            <div className="space-y-4 mt-5">
              <dl className="divide-y divide-[#F1E4ED] border-t border-[#F1E4ED] text-sm">
                {[
                  [c.method, f[method]],
                  [f.recipient, '@' + username],
                  [c.email, email],
                  [r.netRobux, `${units} Robux`],
                  ...(!viaUsername ? [[f.price, `${price} Robux`], [c.gamepassUrl, link]] : []),
                  [c.payment, selectedMethod?.label ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="grid sm:grid-cols-[1fr_2fr] gap-1 sm:gap-4 py-3">
                    <dt className="text-[var(--text-secondary)] font-medium">{label}</dt>
                    <dd className="font-bold text-[#251D2C] break-all sm:text-right">{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-[var(--text-secondary)]">{viaUsername ? u.priceNotice : f.feeNotice}</p>
            </div>
          )}

          {!enabled && (
            <p role="status" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-semibold text-amber-950">
              {c.unavailable}
            </p>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => go(step - 1)}
                className="rounded-xl border border-[#F1E4ED] bg-white px-6 py-3 text-sm font-bold text-[#251D2C] hover:border-pink-300 hover:bg-pink-50 transition cursor-pointer"
              >
                {f.previous}
              </button>
            )}
            <button
              type="submit"
              disabled={busy || (step > 0 && !quote) || (phase >= 3 && (!enabled || !server.quote || !selectedMethod))}
              className="min-w-44 rounded-xl bg-pink-600 px-6 py-3 text-sm font-extrabold text-white transition enabled:hover:bg-pink-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 disabled:bg-[#F1E4ED] disabled:text-[var(--text-secondary)] disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? t.btnProcessing : phase === 4 ? f.confirm : f.next}
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
