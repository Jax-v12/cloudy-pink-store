import crypto from 'crypto';
import { isIP } from 'net';
import { prisma } from '@/lib/prisma';

function normalizeIp(ip: string): string {
  if (isIP(ip) === 6) {
    try {
      return new URL(`http://[${ip}]`).hostname;
    } catch {
      return ip.toLowerCase();
    }
  }
  return ip;
}

/**
 * Safely resolves client key for rate limiting based on trusted boundary.
 *
 * 1. On Vercel runtime (VERCEL === '1'):
 *    Trust is derived from Vercel's network boundary and configuration where the edge
 *    proxy terminates incoming connections, sets `x-real-ip`, and strips client-supplied `x-real-ip`.
 *    If `x-real-ip` is valid (IPv4 or IPv6), it is normalized and used as the clientKey.
 *    If `x-real-ip` is invalid, malformed, or missing, fail closed immediately to 'shared'
 *    WITHOUT falling back to TRUSTED_CLIENT_IP_HEADER.
 *
 * 2. On non-Vercel hosting:
 *    Only trust an explicitly configured `TRUSTED_CLIENT_IP_HEADER` when the operator
 *    guarantees that this single header is strictly overwritten by a trusted reverse proxy
 *    (e.g., cf-connecting-ip or x-real-ip).
 *    Multi-hop / comma-separated chains (like ambiguous x-forwarded-for) are rejected to
 *    prevent misconfiguration and spoofing.
 *    If unconfigured, malformed, or multi-hop, fails closed to 'shared'.
 */
export function clientKey(req: Request): string {
  // 1. Vercel runtime: trust comes from Vercel's edge network boundary
  if (process.env.VERCEL === '1') {
    const vercelRealIp = req.headers.get('x-real-ip')?.trim();
    if (vercelRealIp && !vercelRealIp.includes(',') && isIP(vercelRealIp)) {
      return normalizeIp(vercelRealIp);
    }
    // Fail closed immediately on Vercel: do not fall back to other headers
    return 'shared';
  }

  // 2. Non-Vercel hosting: trust only an operator-guaranteed overwritten reverse proxy header
  const headerName = process.env.TRUSTED_CLIENT_IP_HEADER;
  if (headerName) {
    const rawIp = req.headers.get(headerName)?.trim();
    if (rawIp && !rawIp.includes(',') && isIP(rawIp)) {
      return normalizeIp(rawIp);
    }
  }

  // Fail closed when no trusted proxy configuration is present
  return 'shared';
}

export async function consumeRateLimit(scope: string, key: string, limit: number, windowMs: number): Promise<boolean> {
  const window = Math.floor(Date.now() / windowMs);
  const digest = crypto.createHash('sha256').update(`${scope}:${key}:${window}`).digest('hex');
  const id = `${scope}:${digest}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const row = await prisma.rateLimit.upsert({
        where: { id },
        create: { id, points: 1, expiresAt: new Date((window + 1) * windowMs) },
        update: { points: { increment: 1 } },
      });
      return row.points <= limit;
    } catch (error) {
      if (attempt === 2 || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2002') throw error;
    }
  }
  return false;
}
