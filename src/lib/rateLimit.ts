import crypto from 'crypto';
import { isIP } from 'net';
import { prisma } from '@/lib/prisma';

/** Trust only a configured header that the reverse proxy overwrites. */
export function clientKey(req: Request): string {
  const header = process.env.TRUSTED_CLIENT_IP_HEADER;
  const value = header ? req.headers.get(header)?.trim() : null;
  if (!value || !isIP(value)) return 'shared';
  return isIP(value) === 6 ? new URL(`http://[${value}]`).hostname : value;
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
