import type { MetadataRoute } from 'next';
import { publicSiteOrigin } from '@/lib/siteMetadata';
export default function robots(): MetadataRoute.Robots {
  const origin = publicSiteOrigin();
  const preview = process.env.VERCEL_ENV === 'preview';
  return { rules: { userAgent: '*', ...(preview ? { disallow: '/' } : { allow: '/', disallow: ['/admin', '/order', '/api'] }) },
    ...(!preview && origin ? { sitemap: origin + '/sitemap.xml' } : {}) };
}
