import { NextResponse, type NextRequest } from 'next/server';
import {
  CSP_REPORT_ENDPOINT_NAME,
  buildContentSecurityPolicy,
  generateCspNonce,
  resolveReportEndpointUrl,
} from '@/lib/csp';

export function proxy(request: NextRequest) {
  const nonce = generateCspNonce();
  const isDev = process.env.NODE_ENV === 'development';
  const reportUrl = resolveReportEndpointUrl(
    request.url,
    request.headers.get('host'),
  );
  const cspHeader = buildContentSecurityPolicy({
    nonce,
    isDev,
    includeReportTo: Boolean(reportUrl),
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  if (reportUrl) {
    response.headers.set(
      'Reporting-Endpoints',
      `default="${reportUrl}", ${CSP_REPORT_ENDPOINT_NAME}="${reportUrl}"`,
    );
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml|json)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
