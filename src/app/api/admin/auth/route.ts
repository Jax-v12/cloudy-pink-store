import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

// Fungsi bantuan untuk menghash password dari .env
function getHashedAdminPassword(): string | null {
  const rawPassword = process.env.ADMIN_PASSWORD || '';
  const adminPassword = rawPassword.trim().replace(/^["']|["']$/g, '');
  
  if (!adminPassword) return null;
  
  return crypto.createHash('sha256').update(adminPassword).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const rawPasswordEnv = process.env.ADMIN_PASSWORD || '';
    const adminPasswordEnv = rawPasswordEnv.trim().replace(/^["']|["']$/g, '');

    if (!adminPasswordEnv) {
      return NextResponse.json(
        { success: false, message: 'Server belum dikonfigurasi (ADMIN_PASSWORD kosong).' },
        { status: 500 }
      );
    }

    // Cek password input dengan password asli
    if (password === adminPasswordEnv) {
      const hashedPass = getHashedAdminPassword();
      const cookieStore = await cookies();
      
      // Simpan HASH-nya ke dalam cookie, bukan teks aslinya
      cookieStore.set('admin_session', hashedPass as string, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24, // 1 hari
        path: '/',
      });

      return NextResponse.json({ success: true, message: 'Login berhasil' });
    }

    return NextResponse.json({ success: false, message: 'Password salah' }, { status: 401 });
  } catch (err: unknown) {
    console.error('Error saat login:', err);
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('admin_session')?.value;
    const hashedPass = getHashedAdminPassword();

    // Verifikasi apakah hash di cookie sama dengan hash di server
    if (sessionCookie && hashedPass && sessionCookie === hashedPass) {
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
  cookieStore.delete('admin_session');
  return NextResponse.json({ success: true, message: 'Logout berhasil' });
}