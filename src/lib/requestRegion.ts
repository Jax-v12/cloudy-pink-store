import crypto from 'node:crypto';
import { isRegion, type Region } from './regionalPricing';

export type DetectedRegion = { region: Region | null; reason: 'detected' | 'unverified' | 'unsupported' };

function resolveVercelRegion(req: Request): DetectedRegion {
  // Vercel mode relies on running within the trusted Vercel Edge network boundary.
  // This is an architectural boundary trust check, NOT cryptographic authentication.
  if (process.env.VERCEL !== '1') {
    return { region: null, reason: 'unverified' };
  }

  const vercelId = req.headers.get('x-vercel-id');
  if (!vercelId) {
    return { region: null, reason: 'unverified' };
  }

  const country = req.headers.get('x-vercel-ip-country');
  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return { region: null, reason: 'unverified' };
  }

  return isRegion(country)
    ? { region: country as Region, reason: 'detected' }
    : { region: null, reason: 'unsupported' };
}

function resolveSignedIngressRegion(req: Request): DetectedRegion {
  const unavailable: DetectedRegion = { region: null, reason: 'unverified' };
  const key = process.env.GEOIP_INGRESS_SECRET;
  const audience = process.env.GEOIP_INGRESS_AUDIENCE;
  if (!key || key.length < 32 || !audience) return unavailable;

  const country = req.headers.get('x-store-geo-country') ?? '';
  const timestamp = req.headers.get('x-store-geo-timestamp') ?? '';
  const signature = req.headers.get('x-store-geo-signature') ?? '';

  if (
    !/^[A-Z]{2}$/.test(country) ||
    !/^\d{13}$/.test(timestamp) ||
    !/^[a-f0-9]{64}$/.test(signature) ||
    Math.abs(Date.now() - Number(timestamp)) > 60_000
  ) {
    return unavailable;
  }

  const url = new URL(req.url);
  const message = JSON.stringify(['store-geo-v1', audience, req.method, url.pathname + url.search, country, timestamp]);
  const expected = crypto.createHmac('sha256', key).update(message).digest();
  if (Buffer.from(signature, 'hex').length !== expected.length || !crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) {
    return unavailable;
  }

  return isRegion(country) ? { region: country as Region, reason: 'detected' } : { region: null, reason: 'unsupported' };
}

/**
 * Resolves customer pricing region based on explicitly configured GEOIP_SOURCE:
 * 1. 'signed-ingress': cryptographic HMAC-SHA256 attestation from a trusted proxy. Fails closed.
 * 2. 'vercel': trusted Vercel Edge boundary headers (x-vercel-ip-country + x-vercel-id when VERCEL=1).
 * 3. Default (unset/empty): allows Vercel mode only if running in a Vercel runtime (VERCEL=1).
 * 4. Any unknown or invalid GEOIP_SOURCE fails closed ('unverified') without silent fallback.
 */
export function resolveRequestRegion(req: Request): DetectedRegion {
  const source = process.env.GEOIP_SOURCE;

  if (source === 'signed-ingress') {
    return resolveSignedIngressRegion(req);
  }

  if (source === 'vercel' || (!source && process.env.VERCEL === '1')) {
    return resolveVercelRegion(req);
  }

  // Any unrecognized source or unconfigured non-Vercel environment fails closed.
  return { region: null, reason: 'unverified' };
}
