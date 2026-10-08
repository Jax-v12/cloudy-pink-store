import crypto from 'node:crypto';

export const geoSecret = 'isolated-test-ingress-key-never-use-in-production';
export const geoAudience = 'isolated-cloudy-tests';
export function geoHeaders(url, country = 'ID', method = 'GET', timestamp = String(Date.now())) {
  const parsed = new URL(url);
  const message = JSON.stringify(['store-geo-v1', geoAudience, method, parsed.pathname + parsed.search, country, timestamp]);
  return { 'x-store-geo-country': country, 'x-store-geo-timestamp': timestamp,
    'x-store-geo-signature': crypto.createHmac('sha256', geoSecret).update(message).digest('hex') };
}
