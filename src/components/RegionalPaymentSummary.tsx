'use client';
import { useLanguage } from '@/context/LanguageContext';
import { formatMoney, REGION_CURRENCY, type Region } from '@/lib/regionalPricing';

export type PaymentQuote = { productSubtotal: number; paymentFee: number; discount: number; totalAmount: number };
export default function RegionalPaymentSummary({
  region,
  quote,
  subtotal,
}: {
  region: Region;
  quote: PaymentQuote | null;
  subtotal?: number | null;
}) {
  const { t, language } = useLanguage();
  const r = t.regional;
  const money = (n: number) => formatMoney(n, REGION_CURRENCY[region], language);
  const rows = [
    [r.region, `${r[region]} · ${REGION_CURRENCY[region]}`],
    [r.subtotal, quote ? money(quote.productSubtotal) : subtotal != null ? money(subtotal) : '—'],
    [r.fee, quote ? money(quote.paymentFee) : '—'],
    [r.discount, quote ? money(quote.discount) : '—'],
  ];
  return (
    <div className="rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] p-4 sm:p-5 text-sm">
      <dl className="space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-[#756C7D] font-medium">{label}</dt>
            <dd className="text-right font-bold text-[#251D2C]">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-dashed border-[#F1E4ED] pt-3.5">
        <span className="font-bold text-[#251D2C]">{t.roblox.total}</span>
        <span className="text-right text-xl sm:text-2xl font-extrabold text-pink-600" aria-live="polite">
          {quote ? money(quote.totalAmount) : '—'}
        </span>
      </div>
    </div>
  );
}
