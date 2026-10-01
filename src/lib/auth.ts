import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function verifyAdminAuth(req: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('admin_session_token')?.value || cookieStore.get('admin_session')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  const token = sessionCookie || bearerToken;
  if (!token) return false;

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const session = await prisma.adminSession.findUnique({ where: { tokenHash } });
  
  if (session && session.expiresAt > new Date()) {
    return true;
  }
  
  // fallback for env raw password
  const rawPassword = process.env.ADMIN_PASSWORD || '';
  const adminPassword = rawPassword.trim().replace(/^["']|["']$/g, '');
  if (adminPassword) {
    const hashedAdminPassword = crypto.createHash('sha256').update(adminPassword).digest('hex');
    if (token === hashedAdminPassword) {
      return true;
    }
  }

  return false;
}
