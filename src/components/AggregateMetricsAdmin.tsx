'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
type Counts = { area: string; metric: string; bucket: string; _sum: { count: number | null } };
type Result = { observations: Counts[]; paid: { type: string; _count: { id: number } }[] };
export default function AggregateMetricsAdmin() {
  const { t } = useLanguage(); const a = t.apps;
  const [result, setResult] = useState<Result | null>(null); const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/metrics', { signal: controller.signal }).then(async r => { const j = await r.json(); if (!r.ok || !j.success) throw new Error(); if (!controller.signal.aborted) setResult(j.data); }).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [retry]);
  const counts = (metric: string) => result?.observations.filter(row => row.metric === metric).reduce((sum, row) => sum + (row._sum.count || 0), 0) || 0;
  return <section className="mt-6 space-y-3 rounded-3xl border-2 border-pink-200 bg-white p-5 sm:p-8"><h2 className="text-xl font-bold text-pink-900">{a.metrics}</h2><p className="text-sm leading-6">{a.metricsHint}</p>
    {failed ? <div role="alert">{a.metricsUnavailable} <button className="rounded-xl border p-3" onClick={() => { setFailed(false); setResult(null); setRetry(n => n + 1); }}>{a.retry}</button></div> : !result ? <p role="status">{t.loadingCatalog}</p> : <>
      <dl className="grid gap-3 sm:grid-cols-3">{[[a.views, counts('VIEW')], [a.submits, counts('CHECKOUT_SUBMIT')], [a.paidCount, result.paid.reduce((sum, row) => sum + row._count.id, 0)]].map(([label, value]) => <div key={label} className="rounded-xl bg-pink-50 p-4"><dt className="text-sm">{label}</dt><dd className="text-2xl font-bold">{value}</dd></div>)}</dl>
      <ul className="space-y-2 text-sm">{result.observations.filter(row => row.metric !== 'VIEW' && row.metric !== 'CHECKOUT_SUBMIT').map(row => <li key={`${row.area}:${row.metric}:${row.bucket}`}>{row.area} · {row.metric} · {row.bucket}: {row._sum.count}</li>)}</ul>
    </>}
  </section>;
}
