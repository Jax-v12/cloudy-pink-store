'use client';
import { useLanguage } from '@/context/LanguageContext';
import { type RobloxMethodKey } from '@/lib/roblox';

export default function RobloxInstructions({ method, gamepassPrice }: { method: RobloxMethodKey; gamepassPrice: number | null }) {
  const { t } = useLanguage(); const r = t.roblox;
  return <div className="rounded-xl bg-pink-50 p-4 text-sm space-y-2">
    <h3 className="font-bold text-pink-900">{r.nextSteps}</h3>
    <p>{method === 'GAMEPASS' ? r.invoicePass : method === 'GIFT_USERNAME' ? r.invoiceGift : r.invoiceLogin}</p>
    {method === 'GAMEPASS' && <>{gamepassPrice !== null && <p>{r.priceToSet}: <strong>{gamepassPrice} Robux</strong></p>}<p>{r.pendingNotice}</p></>}
  </div>;
}
