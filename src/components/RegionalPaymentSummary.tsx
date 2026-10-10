'use client';
import { useLanguage } from '@/context/LanguageContext';
import { formatMoney, REGION_CURRENCY, type Region } from '@/lib/regionalPricing';

export type PaymentQuote = { productSubtotal: number; paymentFee: number; discount: number; totalAmount: number };
export default function RegionalPaymentSummary({ region, quote, subtotal }: { region: Region; quote: PaymentQuote | null; subtotal?: number | null }) {
  const { t, language } = useLanguage(); const r = t.regional;
  const money = (n: number) => formatMoney(n, REGION_CURRENCY[region], language);
  const rows = [[r.region, `${r[region]} · ${REGION_CURRENCY[region]}`],
    [r.subtotal, quote ? money(quote.productSubtotal) : subtotal != null ? money(subtotal) : '—'], [r.fee, quote ? money(quote.paymentFee) : '—'],
    [r.discount, quote ? money(quote.discount) : '—']];
  return <div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-4 text-sm">
    <dl className="space-y-2.5">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt className="text-neutral-500">{label}</dt><dd className="text-right font-semibold text-neutral-700">{value}</dd></div>)}</dl>
    <div className="mt-3 flex items-end justify-between gap-3 border-t border-dashed border-pink-200 pt-3">
      <span className="font-semibold text-neutral-700">{t.roblox.total}</span>
      <span className="text-right text-xl font-black text-pink-700" aria-live="polite">{quote ? money(quote.totalAmount) : '—'}</span>
    </div>
  </div>;
}
