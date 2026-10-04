'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { fillTemplate, robloxGamepassPrice, robloxProfileUrl, ROBLOX_USERNAME_PATTERN, type RobloxMethodKey } from '@/lib/roblox';
import RobloxGamepassGuide from './RobloxGamepassGuide';

type Profile = { id: number; name: string; displayName: string; avatarUrl: string | null };
export default function RobloxFields({ method, units, identityOnly = false, initialUsername = '', onUsernameChange }: { method: RobloxMethodKey; units: number; identityOnly?: boolean; initialUsername?: string; onUsernameChange?: (value: string) => void }) {
  const { t } = useLanguage(); const r = t.roblox; const c = t.commerce;
  const [username, setUsername] = useState(initialUsername); const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<'idle' | 'busy' | 'invalid' | 'missing' | 'unavailable'>('idle');
  const controller = useRef<AbortController | null>(null); const input = useRef<HTMLInputElement>(null); const hintId = useId();
  useEffect(() => () => controller.current?.abort(), []);
  const field = 'block w-full mt-1 border border-pink-200 rounded-xl p-3 bg-white focus:outline-pink-500';
  async function check() {
    controller.current?.abort(); setProfile(null); input.current?.setCustomValidity('');
    if (!ROBLOX_USERNAME_PATTERN.test(username.trim())) { setState('invalid'); return; }
    const active = new AbortController(); controller.current = active; setState('busy');
    try {
      const response = await fetch(`/api/roblox/user?username=${encodeURIComponent(username.trim())}`, { signal: active.signal });
      const json = await response.json(); if (active.signal.aborted) return;
      if (!response.ok) { setState(json.errorCode === 'ROBLOX_USER_NOT_FOUND' ? 'missing' : 'unavailable'); input.current?.setCustomValidity(json.errorCode === 'ROBLOX_USER_NOT_FOUND' ? r.userMissing : ''); return; }
      setProfile(json.data); setState('idle'); input.current?.setCustomValidity('');
    } catch { if (!active.signal.aborted) setState('unavailable'); }
  }
  return <div className="space-y-5">
    <div><label className="block font-medium">{c.username}<input ref={input} className={field} name="username" value={username} minLength={3} maxLength={20} pattern="[A-Za-z0-9_]+" required autoComplete="off" autoCapitalize="none" spellCheck={false} aria-describedby={hintId}
      onChange={e => { controller.current?.abort(); setUsername(e.target.value.replace(/^@/, '')); onUsernameChange?.(e.target.value.replace(/^@/, '')); setProfile(null); setState('idle'); e.target.setCustomValidity(''); }} /></label>
      <button type="button" onClick={check} disabled={state === 'busy'} className="mt-2 rounded-lg border border-pink-300 px-4 py-2 text-sm font-semibold text-pink-800 disabled:opacity-50">{state === 'busy' ? r.checking : r.checkUser}</button>
      <div id={hintId} role="status" className="mt-2 text-sm">{state === 'invalid' ? r.invalidUser : state === 'missing' ? r.userMissing : state === 'unavailable' ? r.lookupUnavailable : null}
        {profile && <div className="rounded-xl bg-emerald-50 p-3 flex items-center gap-3">
          {/* Avatar URL is restricted to Roblox's HTTPS CDN by the server. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {profile.avatarUrl && <img src={profile.avatarUrl} width={56} height={56} alt="" referrerPolicy="no-referrer" className="rounded-full" />}
          <div><p className="font-bold">{profile.displayName} <span className="font-normal">@{profile.name}</span></p><p>{r.verified}</p><a href={robloxProfileUrl(profile.id)} target="_blank" rel="noopener noreferrer" className="underline text-emerald-800">{r.profile}</a></div>
        </div>}
      </div>
    </div>
    {!identityOnly && method === 'GAMEPASS' && <>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3" role="status"><p className="font-semibold text-amber-950">{fillTemplate(r.taxNotice, { price: robloxGamepassPrice(units), units })}</p><p className="text-sm text-amber-900">{r.pendingNotice}</p><RobloxGamepassGuide price={robloxGamepassPrice(units)} /></div>
      <label className="block font-medium">{c.gamepassUrl}<input className={field} name="gamepassUrl" type="url" maxLength={500} required placeholder="https://www.roblox.com/game-pass/123456789" /></label>
    </>}
    {!identityOnly && method === 'GIFT_USERNAME' && <p className="rounded-xl bg-sky-50 border border-sky-100 p-4 text-sm text-sky-950">{r.giftNotice}</p>}
    {!identityOnly && method === 'LOGIN' && <>
      <p className="rounded-xl bg-sky-50 border border-sky-200 p-4 text-sm text-sky-950">{t.robloxOps.loginNotice}</p>
      <p className="text-sm text-neutral-600">{t.robloxOps.loginNext}</p>
    </>}
  </div>;
}
