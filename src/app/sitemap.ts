import type { MetadataRoute } from 'next';
import { publicPages, publicSiteOrigin } from '@/lib/siteMetadata';
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  return origin && process.env.VERCEL_ENV !== 'preview' ? publicPages.map(path => ({ url: origin + path })) : [];
}
