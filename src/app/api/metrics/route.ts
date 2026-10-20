import { NextResponse } from 'next/server';
import { sameOrigin } from '@/lib/csrf';
import { readJson, privateHeaders } from '@/lib/http';
import { metricEvent } from '@/lib/aggregateMetricsPolicy';
import { prisma } from '@/lib/prisma';
import { consumeRateLimit, clientKey } from '@/lib/rateLimit';
import { apiError } from '@/lib/apiError';
import { CommerceError } from '@/lib/commerce';

export async function POST(req: Request) {
  try {
    if (process.env.AGGREGATE_METRICS_ENABLED !== 'true') return new NextResponse(null, { status: 204, headers: privateHeaders });
    if (!sameOrigin(req)) throw new CommerceError('UNAUTHORIZED', 403);
    const event = metricEvent(await readJson(req, 256));
    if (!await consumeRateLimit('aggregate-metrics', clientKey(req), 100, 60000)) throw new CommerceError('RATE_LIMITED', 429);
    const day = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
    await prisma.aggregateMetric.upsert({ where: { day_area_metric_bucket: { day, ...event } }, create: { day, ...event, count: 1 }, update: { count: { increment: 1 } } });
    return new NextResponse(null, { status: 204, headers: privateHeaders });
  } catch (e) { return apiError(e); }
}
