/** Browsers control Host and Origin. APP_ORIGIN pins the public HTTPS origin
 * when a reverse proxy gives Next.js an internal request URL. */
export function sameOrigin(req: Request): boolean {
  const supplied = req.headers.get('origin');
  if (!supplied) return false;
  try {
    const internal = new URL(req.url);
    const expected = process.env.APP_ORIGIN
      ? new URL(process.env.APP_ORIGIN).origin
      : new URL(`${internal.protocol}//${req.headers.get('host') || internal.host}`).origin;
    return supplied === expected;
  } catch { return false; }
}
