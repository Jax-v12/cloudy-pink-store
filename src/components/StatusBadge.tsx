import type { ReactNode } from 'react';

export type BadgeTone = 'pink' | 'green' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate';

const tones: Record<BadgeTone, string> = {
  pink: 'bg-pink-50 text-pink-700 ring-pink-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
};

/** Maps order/payment/fulfilment status codes to a consistent visual tone. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'PAID': case 'COMPLETED': case 'succeeded': return 'green';
    case 'PROCESSING': case 'QUEUED': return 'sky';
    case 'WAITING_CUSTOMER': case 'PENDING': case 'NOT_READY': case 'pending': return 'amber';
    case 'REQUIRES_REVIEW': case 'REQUIRED': case 'failed': return 'rose';
    case 'ARCHIVED': return 'violet';
    default: return 'slate';
  }
}

export function StatusBadge({ tone = 'slate', children, dot = true }: { tone?: BadgeTone; children: ReactNode; dot?: boolean }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tones[tone]}`}>
    {dot && <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />}
    <span className="truncate">{children}</span>
  </span>;
}
