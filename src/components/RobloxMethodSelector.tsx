'use client';
import { useLanguage } from '@/context/LanguageContext';
import { ROBLOX_METHODS, type RobloxMethodKey } from '@/lib/roblox';

export default function RobloxMethodSelector({ value, onChange, id, disabled = false }: {
  value: RobloxMethodKey; onChange: (method: RobloxMethodKey) => void; id: string; disabled?: boolean;
}) {
  const { t } = useLanguage(); const r = t.roblox;
  const badges = { GAMEPASS: r.passBadge, GIFT_USERNAME: r.giftBadge, LOGIN: r.loginBadge };
  return <div role="tablist" aria-label={t.commerce.method} className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-pink-200 bg-white/95 backdrop-blur-md p-2 shadow-md shadow-pink-900/10">
    {ROBLOX_METHODS.map((method, index) => <button type="button" role="tab" key={method} id={`${id}-${method}`}
      aria-controls={`${id}-panel`} aria-selected={value === method} tabIndex={value === method ? 0 : -1} disabled={disabled}
      onClick={() => onChange(method)} onKeyDown={e => {
        const next = e.key === 'ArrowRight' ? (index + 1) % 3 : e.key === 'ArrowLeft' ? (index + 2) % 3 : e.key === 'Home' ? 0 : e.key === 'End' ? 2 : null;
        if (next === null) return; e.preventDefault(); onChange(ROBLOX_METHODS[next]);
        document.getElementById(`${id}-${ROBLOX_METHODS[next]}`)?.focus();
      }} className={`min-w-0 rounded-xl px-2 py-3.5 text-center transition focus-visible:outline-2 focus-visible:outline-pink-700 disabled:opacity-50 ${value === method ? 'bg-gradient-to-br from-pink-500 to-rose-400 text-white shadow-md shadow-pink-200' : 'text-neutral-600 hover:bg-pink-50'}`}>
      <span className="block text-sm sm:text-base font-bold">{r[method]}</span>
      <span className={`block mt-1 text-xs leading-snug ${value === method ? 'text-pink-50' : 'text-neutral-500'}`}>{badges[method]}</span>
    </button>)}
  </div>;
}
