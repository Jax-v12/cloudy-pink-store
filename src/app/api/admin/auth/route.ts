import { sameOrigin } from '@/lib/csrf';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifyAdminAuth } from '@/lib/auth';
import { clientKey, consumeRateLimit } from '@/lib/rateLimit';
import { InputError, logFailure, privateHeaders, readJson } from '@/lib/http';

export async function POST(req: Request) {
  try {
    if (req.headers.get('origin') && !sameOrigin(req)) throw new InputError(403);
    if (!(await consumeRateLimit('admin-login', clientKey(req), 5, 15 * 60_000))) {
      return NextResponse.json({ success: false, errorCode: 'RATE_LIMIT_EXCEEDED' }, { status: 429, headers: privateHeaders });
    }
    const { password } = await readJson(req, 4096);
    if (typeof password !== 'string' || password.length === 0 || password.length > 1024) throw new InputError();
    const expected = process.env.ADMIN_PASSWORD?.trim().replace(/^["']|["']$/g, '');
    if (!expected) throw new Error('ADMIN_PASSWORD_REQUIRED');
    const digest = (value: string) => crypto.createHash('sha256').update(value).digest();
    if (!crypto.timingSafeEqual(digest(password), digest(expected))) {
      return NextResponse.json({ success: false, errorCode: 'INVALID_CREDENTIALS' }, { status: 401, headers: privateHeaders });
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = digest(token).toString('hex');
    await prisma.adminSession.create({ data: { tokenHash, expiresAt: new Date(Date.now() + 86_400_000) } });
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    cookieStore.set('admin_session_token', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 86_400, path: '/',
    });
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false, errorCode: error.status === 403 ? 'CSRF_REJECTED' : 'INVALID_INPUT' }, { status: error.status, headers: privateHeaders });
    if (error && typeof error === 'object' && 'code' in error && ['P2021', 'P2022'].includes(String(error.code))) return NextResponse.json({ success: false, errorCode: 'DATABASE_SCHEMA_OUTDATED' }, { status: 503, headers: privateHeaders });
    if (error instanceof Error && error.message === 'ADMIN_PASSWORD_REQUIRED') return NextResponse.json({ success: false, errorCode: 'ADMIN_NOT_CONFIGURED' }, { status: 503, headers: privateHeaders });
    logFailure('Admin login failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const authenticated = await verifyAdminAuth(req);
    return NextResponse.json({ authenticated }, { status: authenticated ? 200 : 401, headers: privateHeaders });
  } catch (error) {
    logFailure('Admin session lookup failed', error);
    return NextResponse.json({ authenticated: false }, { status: 503, headers: privateHeaders });
  }
}

export async function DELETE(req: Request) {
  try {
    const cookieStore = await cookies();
    if (cookieStore.get('admin_session_token') && !sameOrigin(req)) throw new InputError(403);
    const bearer = req.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    const tokens = [cookieStore.get('admin_session_token')?.value, bearer].filter((token): token is string => Boolean(token));
    if (tokens.length) {
      await prisma.adminSession.deleteMany({ where: { tokenHash: { in: tokens.map(token => crypto.createHash('sha256').update(token).digest('hex')) } } });
    }
    // Do not claim logout succeeded if revocation failed.
    cookieStore.delete('admin_session_token');
    cookieStore.delete('admin_session');
    return NextResponse.json({ success: true }, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof InputError) return NextResponse.json({ success: false }, { status: error.status, headers: privateHeaders });
    logFailure('Admin session revocation failed', error);
    return NextResponse.json({ success: false, errorCode: 'SYSTEM_ERROR' }, { status: 503, headers: privateHeaders });
  }
}
