import crypto from 'crypto';
import { adminAccess } from '@/lib/adminAccess';
import { CommerceError } from '@/lib/commerce';

export async function verifyAdminAuth(req: Request, mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method), recent = false): Promise<boolean> {
  try {
    await adminAccess(req, mutation, recent);
    return true;
  } catch (error) {
    if (error instanceof CommerceError) return false;
    throw error;
  }
}

export function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get('authorization');
  if (!secret || !header || !header.startsWith('Bearer ')) return false;
  const token = header.slice(7);
  const tokenHash = crypto.createHash('sha256').update(token).digest();
  const expectedHash = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(tokenHash, expectedHash);
}
