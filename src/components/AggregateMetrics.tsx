'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useReportWebVitals } from 'next/web-vitals';
import { publicMetricArea } from '@/lib/aggregateMetricsPolicy';

let enabled = false;
let documentArea: ReturnType<typeof publicMetricArea> = null;
function allowed() { return enabled && navigator.doNotTrack !== '1' && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl; }
export function observeCheckout(method?: 'GAMEPASS' | 'GIFT_USERNAME' | 'LOGIN') {
  const area = method || publicMetricArea(location.pathname);
  if (area && allowed()) send(area, 'CHECKOUT_SUBMIT', 'COUNT');
}
function send(area: string, metric: string, bucket: string) {
  void fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ area, metric, bucket }), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => { /* Optional observations must not disrupt checkout. */ });
}
const reported = new Set<string>();
const report: Parameters<typeof useReportWebVitals>[0] = metric => {
  const area = documentArea;
  if (!area || !publicMetricArea(location.pathname) || !allowed() || reported.has(metric.id)) return;
  if (!['LCP', 'CLS', 'INP', 'TTFB', 'FCP'].includes(metric.name)) return;
  reported.add(metric.id); if (reported.size > 100) reported.delete(reported.values().next().value!);
  send(area, metric.name, metric.rating.replace('-', '_').toUpperCase());
};
export default function AggregateMetrics({ active }: { active: boolean }) {
  const path = usePathname();
  useEffect(() => { enabled = active; documentArea = publicMetricArea(location.pathname); return () => { enabled = false; }; }, [active]);
  useEffect(() => { const area = publicMetricArea(path); if (area && allowed()) send(area, 'VIEW', 'COUNT'); }, [path]);
  useReportWebVitals(report);
  return null;
}
