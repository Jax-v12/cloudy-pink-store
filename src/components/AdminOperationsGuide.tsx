'use client';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import AdminDialog from './AdminDialog';
import styles from './AdminOperationsGuide.module.css';

export default function AdminOperationsGuide() {
  const { t } = useLanguage();
  const copy = t.adminGuide;
  const [state, setState] = useState<'closed' | 'checking' | 'ready' | 'denied' | 'failed'>('closed');
  const [closing, setClosing] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state !== 'checking' || closing) return;
    const controller = new AbortController();
    fetch('/api/admin/auth', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) return 'denied' as const;
        if (!response.ok) throw new Error('SESSION_CHECK_FAILED');
        return (await response.json()).authenticated === true ? 'ready' as const : 'denied' as const;
      })
      .then(result => { if (!controller.signal.aborted) setState(result); })
      .catch(() => { if (!controller.signal.aborted) setState('failed'); });
    return () => controller.abort();
  }, [state, closing]);
  useEffect(() => {
    if (!closing) return;
    let active = true;
    const animations = content.current?.closest('dialog')?.getAnimations() ?? [];
    Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
      if (active) { setState('closed'); setClosing(false); }
    });
    return () => { active = false; };
  }, [closing]);
  return <>
    <button type="button" onClick={() => setState('checking')} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-pink-200 bg-white px-4 py-2 text-sm font-bold text-pink-700 hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-700">{copy.title}</button>
    {state !== 'closed' && <AdminDialog title={copy.title} width="wide" busy={false} onClose={() => setClosing(true)} className={`${styles.dialog} ${closing ? styles.closing : ''}`}>
      <div className="mb-4 flex shrink-0 justify-end"><button type="button" onClick={() => setClosing(true)} className="min-h-11 rounded-xl border border-pink-200 px-4 py-2 text-sm font-bold text-pink-700 focus-visible:outline-2 focus-visible:outline-pink-700">{copy.close}</button></div>
      <div ref={content} className={styles.content}>
      {state === 'checking' && <p role="status" className="text-sm text-neutral-700">{copy.checking}</p>}
      {state === 'denied' && <p role="alert" className="text-sm text-rose-800">{t.commerce.UNAUTHORIZED}</p>}
      {state === 'failed' && <div role="alert"><p className="text-sm text-rose-800">{t.commerce.SYSTEM_ERROR}</p><button type="button" onClick={() => setState('checking')} className="mt-3 min-h-11 rounded-xl border px-4 text-sm font-bold text-pink-700">{t.commerce.retryLoad}</button></div>}
      {state === 'ready' && <div className="space-y-4">
        <p className="text-sm leading-relaxed text-neutral-700">{copy.intro}</p>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-relaxed text-amber-950">{copy.paymentRule}</p>
        {copy.sections.map(section => <details key={section.title} className={`${styles.section} store-disclosure group rounded-2xl border border-pink-100 bg-white`}>
          <summary tabIndex={0} className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 font-bold text-[#251D2C] focus-visible:outline-2 focus-visible:outline-pink-700"><span>{section.title}</span><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4 shrink-0 transition-transform duration-200 group-open:rotate-180"><path d="m6 9 6 6 6-6" /></svg></summary>
          <ol className="list-decimal space-y-3 px-5 pb-5 pl-10 text-sm leading-relaxed text-neutral-700">{section.steps.map(step => <li key={step}>{step}</li>)}</ol>
        </details>)}
      </div>}
      </div>
    </AdminDialog>}
  </>;
}
