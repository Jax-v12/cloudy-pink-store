'use client';
import { useLanguage } from '@/context/LanguageContext';
import { formatMoney, REGION_CURRENCY, type Region } from '@/lib/regionalPricing';

export type PaymentQuote = { productSubtotal: number; paymentFee: number; discount: number; totalAmount: number };
export default function RegionalPaymentSummary({ region, quote, subtotal }: { region: Region; quote: PaymentQuote | null; subtotal?: number | null }) {
  const { t, language } = useLanguage(); const r = t.regional;
  const money = (n: number) => formatMoney(n, REGION_CURRENCY[region], language);
  const rows = [[r.region, r[region]], [r.currency, REGION_CURRENCY[region]],
    [r.subtotal, quote ? money(quote.productSubtotal) : subtotal != null ? money(subtotal) : '—'], [r.fee, quote ? money(quote.paymentFee) : '—'],
    [r.discount, quote ? money(quote.discount) : '—'], [t.roblox.total, quote ? money(quote.totalAmount) : '—']];
  return <dl className="space-y-3 rounded-2xl bg-pink-50 p-5 text-sm">{rows.map(([label, value]) => <div key={label} className="flex justify-between gap-3"><dt>{label}</dt><dd className="font-semibold text-right">{value}</dd></div>)}</dl>;
}
