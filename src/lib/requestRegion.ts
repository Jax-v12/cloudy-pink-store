import crypto from 'node:crypto';
import { isRegion, type Region } from './regionalPricing';

export type DetectedRegion = { region: Region | null; reason: 'detected' | 'unverified' | 'unsupported' };

/** Only an authenticated ingress can attest GeoIP. Raw CDN, forwarded, cookie and query values are ignored.
 * Disabled by default, including localhost/ngrok. See docs/regional-deployment.md before enabling.
 */
export function resolveRequestRegion(req: Request): DetectedRegion {
  const unavailable: DetectedRegion = { region: null, reason: 'unverified' };
  const key = process.env.GEOIP_INGRESS_SECRET;
  const audience = process.env.GEOIP_INGRESS_AUDIENCE;
  if (process.env.GEOIP_SOURCE !== 'signed-ingress' || !key || key.length < 32 || !audience) return unavailable;
  const country = req.headers.get('x-store-geo-country') ?? '';
  const timestamp = req.headers.get('x-store-geo-timestamp') ?? '';
  const signature = req.headers.get('x-store-geo-signature') ?? '';
  if (!/^[A-Z]{2}$/.test(country) || !/^\d{13}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) ||
      Math.abs(Date.now() - Number(timestamp)) > 60_000) return unavailable;
  const url = new URL(req.url);
  const message = JSON.stringify(['store-geo-v1', audience, req.method, url.pathname + url.search, country, timestamp]);
  const expected = crypto.createHmac('sha256', key).update(message).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return unavailable;
  return isRegion(country) ? { region: country, reason: 'detected' } : { region: null, reason: 'unsupported' };
}
