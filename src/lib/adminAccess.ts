import { sameOrigin } from '@/lib/csrf';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { prisma } from './prisma';
import { CommerceError } from './commerce';

export async function adminAccess(req: Request, mutation = false, recent = false) {
  const jar = await cookies();
  const cookie = jar.get('admin_session_token')?.value;
  const bearer = req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  const token = cookie || bearer;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CommerceError('UNAUTHORIZED', 401);
  if (mutation && cookie && !sameOrigin(req)) throw new CommerceError('CSRF_REJECTED', 403);
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: crypto.createHash('sha256').update(token).digest('hex') } });
  if (!session || session.expiresAt <= new Date()) throw new CommerceError('UNAUTHORIZED', 401);
  if (recent && (!session.reauthenticatedAt || Date.now() - session.reauthenticatedAt.getTime() > 300_000)) throw new CommerceError('REAUTH_REQUIRED', 403);
  return session;
}

export function passwordMatches(password: unknown) {
  const expected = process.env.ADMIN_PASSWORD?.trim().replace(/^["']|["']$/g, '');
  if (!expected || typeof password !== 'string' || !password || password.length > 1024) return false;
  const digest = (s: string) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(digest(password), digest(expected));
}
