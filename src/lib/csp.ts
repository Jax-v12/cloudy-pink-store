const CSP_IMG_SRC =
  "img-src 'self' data: blob: https://*.rbxcdn.com https://thumbnails.roblox.com https://api.sandbox.midtrans.com https://api.midtrans.com";
const CSP_CONNECT_SRC =
  "connect-src 'self' https://api.sandbox.midtrans.com https://api.midtrans.com";

export const CSP_REPORT_ENDPOINT_NAME = 'main-endpoint';

export function buildContentSecurityPolicy(options: {
  nonce?: string;
  isDev: boolean;
  includeReportTo?: boolean;
}): string {
  const scriptSrc = options.nonce
    ? `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic' 'report-sample'${options.isDev ? " 'unsafe-eval'" : ''}`
    : `script-src 'self' 'report-sample'${options.isDev ? " 'unsafe-eval'" : ''}`;

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    CSP_IMG_SRC,
    "font-src 'self' data:",
    CSP_CONNECT_SRC,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  if (options.includeReportTo) {
    directives.push(`report-to ${CSP_REPORT_ENDPOINT_NAME}`);
  }

  return directives.join('; ');
}

function normalizeOriginCandidate(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash ||
      parsed.hostname === 'localhost' ||
      parsed.hostname.endsWith('.localhost') ||
      /^[\d.]+$/.test(parsed.hostname) ||
      parsed.hostname.startsWith('[')
    ) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveReportEndpointUrl(
  requestUrl: string,
  hostHeader?: string | null,
): string | null {
  const configuredOrigin =
    normalizeOriginCandidate(process.env.APP_ORIGIN) ??
    normalizeOriginCandidate(
      process.env.VERCEL_ENV === 'production'
        ? process.env.VERCEL_PROJECT_PRODUCTION_URL
        : process.env.VERCEL_URL,
    );
  if (configuredOrigin) {
    return `${configuredOrigin}/api/csp-report`;
  }

  try {
    const parsed = new URL(requestUrl);
    if (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      ['localhost', '127.0.0.1'].includes(parsed.hostname)
    ) {
      if (hostHeader && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hostHeader.trim())) {
        return `${parsed.protocol}//${hostHeader.trim()}/api/csp-report`;
      }
      return `${parsed.origin}/api/csp-report`;
    }
  } catch {
    return null;
  }

  return null;
}

export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
