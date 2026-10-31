import type { Metadata } from 'next';

export function publicSiteOrigin(value = process.env.APP_ORIGIN): string | null {
  // Use the platform's canonical production host, never a request or preview URL.
  if (!value && process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    value = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith('[')) return null;
    return url.origin;
  } catch { return null; }
}
export const publicPages = ['/', '/apps', '/roblox', '/help', '/privacy'] as const;

export function publicPageMetadata(title: string, description: string): Metadata {
  const origin = publicSiteOrigin();
  return {
    title, description,
    ...(origin ? {
      metadataBase: new URL(origin),
      openGraph: { title, description, images: [{ url: '/banner-logo.png', alt: 'Cloudy Pink Store' }], type: 'website' },
      twitter: { card: 'summary_large_image', title, description, images: ['/banner-logo.png'] },
    } : {}),
  };
}
