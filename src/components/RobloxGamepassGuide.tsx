'use client';
import { useId, useRef } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { fillTemplate } from '@/lib/roblox';

export default function RobloxGamepassGuide({ price }: { price: number }) {
  const { t } = useLanguage(); const r = t.roblox; const dialog = useRef<HTMLDialogElement>(null); const titleId = useId();
  const steps = [
    { title: r.step1, body: r.step1Body, icon: '▦' },
    { title: r.step2, body: r.step2Body, icon: '＋' },
    { title: r.step3, body: fillTemplate(r.step3Body, { price }), icon: '✓' },
    { title: r.step4, body: r.step4Body, icon: '↗' },
  ];
  return <>
    <button type="button" className="text-pink-800 underline underline-offset-4 font-semibold" onClick={() => dialog.current?.showModal()}>{r.guide}</button>
    <dialog ref={dialog} aria-labelledby={titleId} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-3xl p-6 bg-white text-neutral-800 shadow-xl backdrop:bg-black/50">
      <div className="flex justify-between items-start gap-4"><h2 id={titleId} className="text-2xl font-black text-pink-800">{r.guideTitle}</h2><button type="button" onClick={() => dialog.current?.close()} aria-label={r.close} className="rounded-lg border px-3 py-2">×</button></div>
      <p className="mt-3 text-sm text-neutral-600">{r.guideIntro}</p>
      <ol className="my-6 space-y-4">{steps.map((step, i) => <li key={step.title} className="flex gap-4 rounded-2xl border border-pink-100 p-4">
        <div aria-hidden="true" className="shrink-0 flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-pink-700 text-2xl">{step.icon}</div>
        <div className="min-w-0"><h3 className="font-bold">{i + 1}. {step.title}</h3><p className="text-sm mt-1 leading-relaxed">{step.body}</p>
          {i === 2 && <div className="mt-3 p-3 rounded-xl bg-slate-50 border text-sm space-y-2" aria-hidden="true">
            <div className="flex justify-between gap-2"><span>{r.forSale}</span><span className="rounded-full bg-emerald-100 text-emerald-800 px-3">✓ {r.enabled}</span></div>
            <div className="p-2 border rounded-lg bg-white font-mono">{price} Robux</div><span className="inline-block rounded-lg bg-pink-600 text-white px-3 py-1">{r.saveChanges}</span>
          </div>}
        </div>
      </li>)}</ol>
      <div className="flex flex-wrap gap-4 text-sm"><a href="https://create.roblox.com/dashboard/creations" target="_blank" rel="noopener noreferrer" className="text-pink-800 underline">{r.creatorHub}</a><a href="https://create.roblox.com/docs/production/monetization/passes" target="_blank" rel="noopener noreferrer" className="text-pink-800 underline">{r.officialGuide}</a></div>
      <button type="button" onClick={() => dialog.current?.close()} className="mt-5 w-full rounded-xl bg-pink-600 p-3 text-white font-bold">{r.close}</button>
    </dialog>
  </>;
}
