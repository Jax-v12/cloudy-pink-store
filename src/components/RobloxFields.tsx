'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { fillTemplate, robloxGamepassPrice, robloxProfileUrl, ROBLOX_USERNAME_PATTERN, type RobloxMethodKey } from '@/lib/roblox';
import RobloxGamepassGuide from './RobloxGamepassGuide';

type Profile = { id: number; name: string; displayName: string; avatarUrl: string | null };
export default function RobloxFields({
  method,
  units,
  identityOnly = false,
  initialUsername = '',
  onUsernameChange,
}: {
  method: RobloxMethodKey;
  units: number;
  identityOnly?: boolean;
  initialUsername?: string;
  onUsernameChange?: (value: string) => void;
}) {
  const { t } = useLanguage();
  const r = t.roblox;
  const c = t.commerce;
  const [username, setUsername] = useState(initialUsername);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'invalid' | 'missing' | 'unavailable'>('idle');
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const hintId = useId();

  useEffect(() => () => controller.current?.abort(), []);
  const field =
    'block w-full mt-1.5 rounded-2xl border border-[#F1E4ED] bg-[#FFF9FC] px-4 py-3 text-[#251D2C] font-medium focus:border-pink-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-pink-500/10 transition-all';

  async function check() {
    controller.current?.abort();
    setProfile(null);
    input.current?.setCustomValidity('');
    if (!ROBLOX_USERNAME_PATTERN.test(username.trim())) {
      setState('invalid');
      return;
    }
    const active = new AbortController();
    controller.current = active;
    setState('busy');
    try {
      const response = await fetch(`/api/roblox/user?username=${encodeURIComponent(username.trim())}`, { signal: active.signal });
      const json = await response.json();
      if (active.signal.aborted) return;
      if (!response.ok) {
        setState(json.errorCode === 'ROBLOX_USER_NOT_FOUND' ? 'missing' : 'unavailable');
        input.current?.setCustomValidity(json.errorCode === 'ROBLOX_USER_NOT_FOUND' ? r.userMissing : '');
        return;
      }
      setProfile(json.data);
      setState('idle');
      input.current?.setCustomValidity('');
    } catch {
      if (!active.signal.aborted) setState('unavailable');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-bold text-[#251D2C]">
          {c.username}
          <input
            ref={input}
            className={field}
            name="username"
            value={username}
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_]+"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-describedby={hintId}
            onChange={e => {
              controller.current?.abort();
              setUsername(e.target.value.replace(/^@/, ''));
              onUsernameChange?.(e.target.value.replace(/^@/, ''));
              setProfile(null);
              setState('idle');
              e.target.setCustomValidity('');
            }}
          />
        </label>
        <button
          type="button"
          onClick={check}
          disabled={state === 'busy'}
          className="mt-2.5 rounded-xl border border-[#F1E4ED] bg-white px-4 py-2 text-xs sm:text-sm font-bold text-pink-700 shadow-2xs hover:border-pink-300 hover:bg-pink-50 transition disabled:opacity-50 cursor-pointer"
        >
          {state === 'busy' ? r.checking : r.checkUser}
        </button>
        <div id={hintId} role="status" className="mt-2.5 text-sm">
          {state === 'invalid' ? (
            <span className="font-semibold text-rose-700">{r.invalidUser}</span>
          ) : state === 'missing' ? (
            <span className="font-semibold text-rose-700">{r.userMissing}</span>
          ) : state === 'unavailable' ? (
            <span className="font-semibold text-amber-800">{r.lookupUnavailable}</span>
          ) : null}
          {profile && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-center gap-3.5">
              {/* Avatar URL is restricted to Roblox's HTTPS CDN by the server. */}
              {profile.avatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} width={52} height={52} alt="" referrerPolicy="no-referrer" className="rounded-full border border-emerald-200 bg-white" />
              )}
              <div>
                <p className="font-extrabold text-[#251D2C]">
                  {profile.displayName} <span className="font-medium text-[#756C7D]">@{profile.name}</span>
                </p>
                <p className="text-xs font-semibold text-emerald-800">{r.verified}</p>
                <a href={robloxProfileUrl(profile.id)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold underline text-emerald-800">
                  {r.profile}
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {!identityOnly && method === 'GAMEPASS' && (
        <>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-2.5" role="status">
            <p className="font-bold text-amber-950">{fillTemplate(r.taxNotice, { price: robloxGamepassPrice(units), units })}</p>
            <p className="text-sm text-amber-900">{r.pendingNotice}</p>
            <RobloxGamepassGuide price={robloxGamepassPrice(units)} />
          </div>
          <label className="block text-sm font-bold text-[#251D2C]">
            {c.gamepassUrl}
            <input className={field} name="gamepassUrl" type="url" maxLength={500} required placeholder="https://www.roblox.com/game-pass/123456789" />
          </label>
        </>
      )}
      {!identityOnly && method === 'GIFT_USERNAME' && (
        <p className="rounded-2xl bg-sky-50/80 border border-sky-200 p-4 text-sm text-sky-950">{r.giftNotice}</p>
      )}
      {!identityOnly && method === 'LOGIN' && (
        <>
          <p className="rounded-2xl bg-sky-50/80 border border-sky-200 p-4 text-sm text-sky-950">{t.robloxOps.loginNotice}</p>
          <p className="text-sm text-[#756C7D]">{t.robloxOps.loginNext}</p>
        </>
      )}
    </div>
  );
}
