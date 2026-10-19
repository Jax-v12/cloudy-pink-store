'use client';

import Link from 'next/link';
import { useLanguage } from '@/context/LanguageContext';
import { orderProgress } from '@/lib/orderNotice';

export default function OrderProgress({ order }: { order: Parameters<typeof orderProgress>[0] }) {
  const { t } = useLanguage();
  const copy = t.serviceHelp.progress;
  const progress = orderProgress(order);
  const readyAccount = order.type === 'APPS' && order.appsSnapshot?.fulfillmentMode !== 'ACTIVATION';
  const stages = readyAccount
    ? ['payment', 'processing', 'completed'] as const
    : ['payment', 'queued', 'processing', 'completed'] as const;
  const currentIndex = stages.findIndex(stage => stage === progress.stage);
  const messages = { ...copy, queued: copy.queuedMessage, processing: copy.processingMessage, completed: copy.completedMessage };
  const message = messages[progress.message];
  const needsAttention = progress.stage === null || progress.message === 'waitingCustomer';

  return <section aria-labelledby="order-progress-title" className="mb-6 rounded-2xl border-2 border-pink-200 bg-white p-4 sm:p-5">
    <h2 id="order-progress-title" className="text-base font-black text-pink-900">{copy.title}</h2>
    {progress.stage !== null && <ol className={`mt-4 grid gap-3 ${readyAccount ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
      {stages.map((stage, index) => {
        const current = index === currentIndex;
        const done = currentIndex > index || (current && stage === 'completed');
        return <li key={stage} aria-current={current ? 'step' : undefined} className={`flex items-start gap-2 rounded-xl border p-3 text-xs font-bold leading-5 ${current ? 'border-pink-600 bg-pink-50 text-pink-900' : done ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          <span aria-hidden="true" className="shrink-0">{done ? '✓' : index + 1}</span>
          <span>{readyAccount && stage === 'processing' ? copy.preparingStep : copy[stage]}<span className="sr-only"> · {current ? copy.current : done ? copy.done : copy.next}</span></span>
        </li>;
      })}
    </ol>}
    <p role="status" className={`mt-4 rounded-xl p-3 text-sm leading-relaxed ${needsAttention ? 'bg-amber-50 text-amber-950' : 'bg-slate-50 text-slate-700'}`}>{message}</p>
    <Link href="/help#order-status" className="mt-3 inline-block rounded text-sm font-semibold text-pink-800 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4">{copy.help}</Link>
  </section>;
}
