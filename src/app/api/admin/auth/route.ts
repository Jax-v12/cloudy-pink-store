import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const rateLimitId = 'admin_login_attempt';
    const now = new Date();
    
    let rateLimit = await prisma.rateLimit.findUnique({ where: { id: rateLimitId } });
    if (!rateLimit || rateLimit.expiresAt < now) {
      rateLimit = await prisma.rateLimit.upsert({
        where: { id: rateLimitId },
        update: { points: 1, expiresAt: new Date(now.getTime() + 15 * 60 * 1000) }, // 15 menit
        create: { id: rateLimitId, points: 1, expiresAt: new Date(now.getTime() + 15 * 60 * 1000) },
      });
    } else {
      if (rateLimit.points >= 5) {
        return NextResponse.json({ success: false, message: 'Terlalu banyak percobaan login. Coba lagi nanti.' }, { status: 429 });
      }
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }
    const { password } = body;
    if (typeof password !== 'string') {
      return NextResponse.json({ success: false, message: 'Password tidak valid' }, { status: 400 });
    }
    const rawPasswordEnv = process.env.ADMIN_PASSWORD || '';
    const adminPasswordEnv = rawPasswordEnv.trim().replace(/^["']|["']$/g, '');

    if (!adminPasswordEnv) {
      return NextResponse.json(
        { success: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD kosong).' },
        { status: 500 }
      );
    }

    if (password === adminPasswordEnv) {
      // Login berhasil, reset rate limit
      await prisma.rateLimit.delete({ where: { id: rateLimitId } }).catch(() => {});
      const sessionToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 hari
      
      await prisma.adminSession.create({
        data: {
          tokenHash,
          expiresAt,
        }
      });

      const cookieStore = await cookies();
      cookieStore.set('admin_session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 hari
        path: '/',
      });

      return NextResponse.json({ success: true, message: 'Login berhasil' });
    }

    // Login gagal, increment rate limit
    await prisma.rateLimit.update({
      where: { id: rateLimitId },
      data: { points: rateLimit.points + 1 },
    }).catch(() => {});

    return NextResponse.json({ success: false, message: 'Password salah' }, { status: 401 });
  } catch (err: unknown) {
    console.error('Error saat login:', err);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('admin_session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    
    const session = await prisma.adminSession.findUnique({
      where: { tokenHash }
    });

    if (session && session.expiresAt > new Date()) {
      return NextResponse.json({ authenticated: true });
    }
    
    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch (error: unknown) {
    console.error('Error cek sesi:', error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}

export async function DELETE() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session_token')?.value;
  
  if (sessionToken) {
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    try {
      await prisma.adminSession.deleteMany({
        where: { tokenHash }
      });
    } catch (err) {
      console.error('Error revoking session:', err);
    }
  }

  cookieStore.delete('admin_session_token');
  return NextResponse.json({ success: true, message: 'Logout berhasil' });
}