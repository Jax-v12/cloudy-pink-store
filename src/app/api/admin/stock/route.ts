import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { encryptData } from '@/lib/crypto';

// 1. Fungsi Cek Auth (Sudah pakai Hash SHA-256)
function verifyAdminAuth(req: Request, cookieStore: Awaited<ReturnType<typeof cookies>>): boolean {
  const rawPassword = process.env.ADMIN_PASSWORD || '';
  const adminPassword = rawPassword.trim().replace(/^["']|["']$/g, '');
  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD belum dikonfigurasi di environment server.');
  }

  const hashedAdminPassword = crypto.createHash('sha256').update(adminPassword).digest('hex');
  
  const sessionCookie = cookieStore.get('admin_session')?.value;
  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  return sessionCookie === hashedAdminPassword || bearerToken === hashedAdminPassword;
}

// 3. Method POST (Untuk nambah stok baru dari Dashboard)
export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminAuth(req, cookieStore)) {
      return NextResponse.json({ success: false, message: 'Akses ditolak (Unauthorized).' }, { status: 401 });
    }

    const body = await req.json();
    const { productName, price, category, emailAccount, passwordAccount, profileName, pin, additionalInfo } = body;

    if (!productName || !price || !emailAccount || !passwordAccount) {
      return NextResponse.json(
        { success: false, message: 'Nama produk, harga, email, dan password wajib diisi.' },
        { status: 400 }
      );
    }

    const parsedPrice = Math.round(Number(price));
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json(
        { success: false, message: 'Harga harus berupa angka bulat positif.' },
        { status: 400 }
      );
    }

    const cleanName = String(productName).trim().slice(0, 100);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

    let product = await prisma.product.findFirst({
      where: { name: cleanName },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: cleanName,
          slug: `${slug}-${Date.now()}`,
          price: parsedPrice,
          category: category ? String(category).trim().slice(0, 50) : 'Apps Premium',
        },
      });
    }

    // Gunakan fungsi encryptData yang sudah kita buat di atas
    const encryptedPassword = encryptData(String(passwordAccount));

    const newStock = await prisma.accountStock.create({
      data: {
        productId: product.id,
        emailAccount: String(emailAccount).trim().slice(0, 150),
        passwordAccount: encryptedPassword,
        profileName: profileName ? String(profileName).trim().slice(0, 50) : null,
        pin: pin ? String(pin).trim().slice(0, 20) : null,
        additionalInfo: additionalInfo ? String(additionalInfo).trim().slice(0, 500) : null,
        status: 'READY',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Stok berhasil ditambahkan!',
      data: newStock,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal menyimpan stok akun.';
    console.error('Error add stock:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}

// 4. Method GET (Untuk nampilin daftar stok di Dashboard)
export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminAuth(req, cookieStore)) {
      return NextResponse.json({ success: false, message: 'Akses ditolak (Unauthorized).' }, { status: 401 });
    }

    const stocks = await prisma.accountStock.findMany({
      include: {
        product: { select: { name: true, price: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, data: stocks });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memuat data stok.';
    console.error('Error fetch stocks:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}