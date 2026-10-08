import { isRegion, type Region } from './regionalPricing';

export type DetectedRegion = { region: Region | null; reason: 'detected' | 'unverified' | 'unsupported' };

/**
 * Resolves the customer's region using Vercel's built-in GeoIP headers.
 * Relies on `x-vercel-id` to ensure the request actually passed through Vercel Edge,
 * preventing spoofing via direct access or other CDNs.
 */
export function resolveRequestRegion(req: Request): DetectedRegion {
  const vercelId = req.headers.get('x-vercel-id');
  
  // If the request didn't come through Vercel Edge, we cannot trust the headers.
  if (!vercelId) {
    return { region: null, reason: 'unverified' };
  }

  const country = req.headers.get('x-vercel-ip-country');
  if (!country || !/^[A-Z]{2}$/.test(country)) {
    return { region: null, reason: 'unverified' };
  }

  return isRegion(country) ? { region: country as Region, reason: 'detected' } : { region: null, reason: 'unsupported' };
}
