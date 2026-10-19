export function publicSiteOrigin(value = process.env.APP_ORIGIN): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || url.hostname === 'localhost' || /^[\d.]+$/.test(url.hostname) || url.hostname.startsWith('[')) return null;
    return url.origin;
  } catch { return null; }
}
export const publicPages = ['/', '/apps', '/roblox', '/help', '/privacy'] as const;
