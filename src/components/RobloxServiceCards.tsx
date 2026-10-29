'use client';
import { useState } from 'react';
import { formatMoney, REGION_CURRENCY, type Region, type RegionalPrice } from '@/lib/regionalPricing';
import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { type RobloxMethodKey } from '@/lib/roblox';

type Product = {
  id: number;
  slug: string;
  name: string;
  checkoutEnabled: boolean;
  variants: { regionalPrices?: RegionalPrice[]; method: string | null; price: number | null; units: number }[];
};

function ServiceArt({ method }: { method: RobloxMethodKey }) {
  const paths = {
    GAMEPASS: 'M5 5h14v14H5z M10 10h4v4h-4z',
    LOGIN: 'M8 10V7a4 4 0 0 1 8 0v3 M6 10h12v11H6z M12 14v3',
    GIFT_USERNAME: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true" className="h-9 w-9 shrink-0 text-[var(--text-secondary)]"><path d={paths[method]} /></svg>;
}

export default function RobloxServiceCards({ products, region }: { products: Product[]; region: Region | null }) {
  const { t, language } = useLanguage();
  const f = t.robloxFlow;
  const comparison = t.serviceHelp.comparison;
  const [selection, setSelection] = useState<Partial<Record<RobloxMethodKey, number>>>({});
  const tag = { GAMEPASS: f.passTag, LOGIN: f.loginTag, GIFT_USERNAME: f.giftTag };

  return (
    <section aria-labelledby="method-comparison-title">
      <div className="mb-3.5 sm:mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 rounded-2xl border border-[#F1E4ED] bg-white px-4 py-3 sm:px-5 sm:py-4">
        <h2 id="method-comparison-title" className="text-base sm:text-xl font-extrabold text-[#251D2C]">
          {comparison.title}
        </h2>
        <p className="text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">{comparison.intro}</p>
      </div>

      <div className="grid items-start gap-4 sm:gap-5 lg:grid-cols-3">
        {(['GAMEPASS', 'LOGIN', 'GIFT_USERNAME'] as const).map(method => {
          const eligible = products.filter(p => p.variants.some(v => v.method === method));
          const product = eligible.find(p => p.id === selection[method]) ?? eligible[0];
          const rate = region
            ? product?.variants.filter(v => v.method === method).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity))[0]
            : undefined;
          const amount = rate?.price ?? null;
          const price = amount === null || !region ? t.regional.unavailable : formatMoney(amount, REGION_CURRENCY[region], language);
          const ready = Boolean(product && region && amount !== null && product.checkoutEnabled);

          return (
            <article
              key={method}
              className={`group flex min-w-0 flex-col overflow-hidden rounded-3xl border bg-white transition-[border-color,box-shadow] duration-200 ${
                ready
                  ? 'border-[#F1E4ED] hover:border-pink-300'
                  : 'border-[#F1E4ED] bg-white/95 opacity-95'
              }`}
            >
              <div className="relative flex items-start justify-between gap-3 border-b border-[#F1E4ED]/70 bg-white px-4 pt-4 pb-3 sm:px-5 sm:pt-5 lg:min-h-32">
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-lg border border-pink-200 bg-white px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-pink-600">
                    {t.roblox[method]}
                  </span>
                  <h3 className="mt-1.5 text-lg font-extrabold leading-tight text-[#251D2C] sm:text-xl">
                    {f[method]}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-secondary)]">{tag[method]}</p>
                </div>
                <div className="-mr-1 shrink-0 pt-1">
                  <ServiceArt method={method} />
                </div>
              </div>

              <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5 sm:px-5 sm:pb-5">
                <div className="space-y-3">
                  {eligible.length > 1 && (
                    <label className="block text-xs font-bold text-[var(--text-secondary)]">
                      {t.commerce.product}
                      <select
                        className="mt-1.5 w-full rounded-xl border border-[#F1E4ED] bg-[#FFF9FC] p-2.5 text-sm font-semibold text-[#251D2C] focus:border-pink-500 focus:outline-none"
                        value={product?.id}
                        onChange={e => setSelection(old => ({ ...old, [method]: Number(e.target.value) }))}
                      >
                        {eligible.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  {rate && amount !== null && (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pink-100 bg-[#FFF9FC] px-4 py-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-pink-600">
                          {t.commerce.startingFrom}
                        </p>
                        <p className="mt-0.5 text-base sm:text-lg font-extrabold text-[#251D2C]">
                          {price}{' '}
                          <span className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)]">
                            / {rate.units} Robux
                          </span>
                        </p>
                      </div>
                      {ready && product && (
                        <Link
                          href={`/roblox/${product.slug}?method=${method}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-pink-600 hover:bg-pink-700 px-4 py-2.5 text-sm font-extrabold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600"
                        >
                          <span>{f.buy}</span>
                          <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
                            →
                          </span>
                        </Link>
                      )}
                    </div>
                  )}

                  {(!ready || !product) && (
                    <div className="flex items-center gap-2.5 rounded-2xl border border-dashed border-[#F1E4ED] bg-[#FFF9FC] px-3.5 py-3 text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                      <p>
                        {!region
                          ? t.regional.locationUnavailable
                          : !product || amount === null
                            ? t.regional.unavailable
                            : product.checkoutEnabled
                              ? t.regional.paymentUnavailable
                              : t.commerce.unavailable}
                      </p>
                    </div>
                  )}
                </div>

                <p className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm text-[var(--text-secondary)]">
                  <span>{comparison.estimateLabel}</span>
                  <strong className="text-[#251D2C]">{comparison.estimates[method]}</strong>
                </p>

                <details className="store-disclosure group/details mt-3 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC]/70 text-xs sm:text-sm text-[var(--text-secondary)]">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 font-bold text-[#251D2C] transition-colors hover:bg-pink-50 hover:text-pink-700 focus-visible:outline-2 focus-visible:outline-pink-800">
                    <span>{comparison.detailsSummary}</span>
                    <span
                      aria-hidden="true"
                      className="text-xs text-pink-600 transition-transform duration-200 group-open/details:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <dl className="mx-3.5 mb-3.5 space-y-2.5 border-t border-[#F1E4ED] pt-2.5 leading-relaxed">
                    {(['requirements', 'process', 'timing'] as const).map(field => (
                      <div key={field}>
                        <dt className="font-bold text-[#251D2C]">{comparison[field]}</dt>
                        <dd className="mt-0.5 text-[var(--text-secondary)]">{comparison[method][field]}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mt-4 rounded-2xl border border-[#F1E4ED] bg-white px-4 py-3 sm:p-4 text-xs sm:text-sm leading-relaxed text-[var(--text-secondary)]">
        {comparison.notice}
        <span className="mt-1 block">{comparison.estimateNotice}</span>
      </p>
    </section>
  );
}
