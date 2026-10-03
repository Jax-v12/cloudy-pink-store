import { sameOrigin } from '@/lib/csrf';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function verifyAdminAuth(req: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session_token')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (sessionCookie && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !sameOrigin(req)) return false;
  const token = sessionCookie || bearerToken;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prisma.adminSession.findUnique({ where: { tokenHash } });
  
  return Boolean(session && session.expiresAt > new Date());
}
