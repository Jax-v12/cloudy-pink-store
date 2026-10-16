'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useLanguage } from '@/context/LanguageContext';
import { ROBLOX_USERNAME_PATTERN } from '@/lib/roblox';

type Profile = { id: number; name: string; displayName: string; avatarUrl: string | null };
type Phase = 'idle' | 'loading' | 'invalid' | 'missing' | 'rate' | 'timeout' | 'unavailable' | 'found';
export default function LoginUsernameField({ value, onChange, invalid, className }: {
  value: string; onChange: (value: string) => void; invalid: boolean; className: string;
}) {
  const { t } = useLanguage(); const l = t.loginFlow;
  const [lookup, setLookup] = useState<{ input: string; phase: Phase; profile?: Profile }>({ input: value, phase: 'idle' });
  const request = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout> } | null>(null);
  useEffect(() => () => { request.current?.controller.abort(); clearTimeout(request.current?.timer); }, [value]);
  const state = lookup.input === value ? lookup : { phase: 'idle' as const, profile: undefined };
  async function check() {
    request.current?.controller.abort(); clearTimeout(request.current?.timer);
    const username = value.trim();
    if (!ROBLOX_USERNAME_PATTERN.test(username)) { setLookup({ input: value, phase: 'invalid' }); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(); setLookup({ input: value, phase: 'timeout' });
    }, 10_000);
    request.current = { controller, timer }; setLookup({ input: value, phase: 'loading' });
    try {
      const response = await fetch(`/api/roblox/user?username=${encodeURIComponent(username)}`, { signal: controller.signal, cache: 'no-store' });
      const json = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok || !json.success) {
        setLookup({ input: value, phase: response.status === 429 ? 'rate' : response.status === 404 && json.errorCode === 'ROBLOX_USER_NOT_FOUND' ? 'missing' : 'unavailable' }); return;
      }
      const profile = json.data;
      if (!profile || !Number.isSafeInteger(profile.id) || profile.id <= 0 || typeof profile.name !== 'string' || !ROBLOX_USERNAME_PATTERN.test(profile.name) ||
          typeof profile.displayName !== 'string' || !profile.displayName || profile.displayName.length > 64) throw new Error('INVALID_PUBLIC_PROFILE');
      let avatarUrl: string | null = null;
      if (typeof profile.avatarUrl === 'string') {
        const avatar = new URL(profile.avatarUrl);
        if (avatar.protocol === 'https:' && avatar.hostname.endsWith('.rbxcdn.com') && !avatar.username && !avatar.password && !avatar.port) avatarUrl = avatar.href;
      }
      setLookup({ input: value, phase: 'found', profile: { id: profile.id, name: profile.name, displayName: profile.displayName, avatarUrl } });
    } catch { if (!controller.signal.aborted) setLookup({ input: value, phase: 'unavailable' }); }
    finally { clearTimeout(timer); }
  }
  const message = { idle: '', found: '', loading: l.usernameChecking, invalid: l.invalidUsername, missing: l.usernameMissing,
    rate: l.usernameRateLimit, timeout: l.usernameTimeout, unavailable: l.usernameUnavailable }[state.phase];
  return <div>
    <label htmlFor="login-username" className="block font-semibold text-neutral-800">{l.username}</label>
    <input id="login-username" name="username" className={className} value={value} onChange={event => onChange(event.target.value)} maxLength={20}
      autoComplete="off" autoCapitalize="none" spellCheck={false} aria-invalid={invalid || state.phase === 'invalid' || state.phase === 'missing'} aria-describedby="login-username-error login-username-lookup" />
    {invalid && <p id="login-username-error" role="alert" className="mt-2 text-rose-800">{l.invalidUsername}</p>}
    <button type="button" disabled={state.phase === 'loading'} onClick={() => void check()}
      className="mt-3 rounded-xl border-2 border-pink-300 px-4 py-3 font-semibold text-pink-900 focus-visible:outline-2 focus-visible:outline-pink-800 disabled:opacity-50">{l.checkUsername}</button>
    <div id="login-username-lookup" role="status" className="mt-3 text-sm text-pink-900">
      {message}
      {state.profile && <div className="flex min-w-0 items-center gap-3 rounded-xl border border-pink-200 bg-pink-50 p-3">
        {state.profile.avatarUrl && <Image src={state.profile.avatarUrl} alt="" width={56} height={56} unoptimized referrerPolicy="no-referrer" className="shrink-0 rounded-full" />}
        <div className="min-w-0 break-words"><p className="font-bold">{state.profile.displayName}</p><p>@{state.profile.name}</p><p>{l.robloxUserId}: {state.profile.id}</p></div>
      </div>}
    </div>
  </div>;
}
