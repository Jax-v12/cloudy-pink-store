import { NextResponse } from 'next/server';

const MAX_REPORT_BYTES = 16_384;
const ALLOWED_CONTENT_TYPES = new Set([
  'application/reports+json',
  'application/csp-report',
  'application/json',
]);
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function sanitizeUrlPath(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;
  if (value === 'inline' || value === 'eval' || value === 'self' || value === 'data' || value === 'blob') {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return parsed.protocol.replace(/:$/, '');
  } catch {
    return undefined;
  }
}

function summarizeReportEntry(entry: unknown): Record<string, unknown> | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  const rawBody =
    record.body && typeof record.body === 'object' && !Array.isArray(record.body)
      ? (record.body as Record<string, unknown>)
      : record['csp-report'] && typeof record['csp-report'] === 'object' && !Array.isArray(record['csp-report'])
        ? (record['csp-report'] as Record<string, unknown>)
        : record;

  const directive =
    typeof rawBody.effectiveDirective === 'string'
      ? rawBody.effectiveDirective
      : typeof rawBody['effective-directive'] === 'string'
        ? rawBody['effective-directive']
        : typeof rawBody.violatedDirective === 'string'
          ? rawBody.violatedDirective
          : typeof rawBody['violated-directive'] === 'string'
            ? rawBody['violated-directive']
            : undefined;
  const blocked = sanitizeUrlPath(rawBody.blockedURL ?? rawBody['blocked-uri']);
  const disposition =
    typeof rawBody.disposition === 'string' ? rawBody.disposition : undefined;

  if (!directive && !blocked) return null;
  return {
    type: typeof record.type === 'string' ? record.type : 'csp-violation',
    directive,
    blocked,
    disposition,
  };
}

export async function POST(req: Request) {
  const mediaType = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(mediaType)) {
    return new NextResponse(null, { status: 415, headers: NO_STORE_HEADERS });
  }

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) {
    return new NextResponse(null, { status: 413, headers: NO_STORE_HEADERS });
  }

  try {
    const rawText = await req.text();
    if (!rawText || Buffer.byteLength(rawText, 'utf8') > MAX_REPORT_BYTES) {
      return new NextResponse(null, {
        status: rawText ? 413 : 204,
        headers: NO_STORE_HEADERS,
      });
    }

    const parsed: unknown = JSON.parse(rawText);
    const entries = Array.isArray(parsed) ? parsed.slice(0, 10) : [parsed];
    const summaries = entries
      .map(summarizeReportEntry)
      .filter((item): item is Record<string, unknown> => item !== null);

    if (summaries.length > 0 && process.env.NODE_ENV !== 'test') {
      console.warn('CSP report', JSON.stringify(summaries));
    }
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE_HEADERS });
  }

  return new NextResponse(null, { status: 204, headers: NO_STORE_HEADERS });
}
