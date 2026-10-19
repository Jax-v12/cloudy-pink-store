import { InputError } from './http';
export const metricAreas = ['HOME', 'APPS', 'APPS_DETAIL', 'ROBLOX', 'ROBLOX_DETAIL', 'GAMEPASS', 'GIFT_USERNAME', 'LOGIN'] as const;
export function publicMetricArea(path: string): typeof metricAreas[number] | null {
  const exact: Record<string, typeof metricAreas[number]> = { '/': 'HOME', '/apps': 'APPS', '/roblox': 'ROBLOX', '/roblox/gamepass': 'GAMEPASS', '/roblox/username': 'GIFT_USERNAME', '/roblox/login': 'LOGIN' };
  if (exact[path]) return exact[path];
  if (/^\/roblox\/[a-zA-Z0-9_-]+\/login\/(?:account|summary)$/.test(path)) return 'LOGIN';
  if (/^\/roblox\/[a-zA-Z0-9_-]+$/.test(path)) return 'ROBLOX_DETAIL';
  return /^\/apps\/[a-zA-Z0-9_-]+$/.test(path) ? 'APPS_DETAIL' : null;
}
export function metricEvent(body: Record<string, unknown>) {
  const { area, metric, bucket } = body;
  if (Object.keys(body).some(k => !['area', 'metric', 'bucket'].includes(k)) || !metricAreas.some(a => a === area) || typeof metric !== 'string' || typeof bucket !== 'string') throw new InputError();
  const count = ['VIEW', 'CHECKOUT_SUBMIT'].includes(metric) && bucket === 'COUNT';
  const vital = ['LCP', 'CLS', 'INP', 'TTFB', 'FCP'].includes(metric) && ['GOOD', 'NEEDS_IMPROVEMENT', 'POOR'].includes(bucket);
  if (!count && !vital) throw new InputError();
  return { area: String(area), metric, bucket };
}
