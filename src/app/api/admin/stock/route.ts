import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { encryptData, decryptData } from '@/lib/crypto';
import { verifyAdminAuth } from '@/lib/auth';

function safeDecrypt(encryptedText: string): string {
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3 || parts[0].length !== 32 || parts[1].length !== 32) {
      return encryptedText; // Fallback for old plaintext
    }
    return decryptData(encryptedText);
  } catch {
    return '[Data tidak dapat didekripsi]';
  }
}

// 3. Method POST (Untuk nambah stok baru dari Dashboard)
export async function POST(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) {
      return NextResponse.json({ success: false, message: 'Akses ditolak (Unauthorized).' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json() as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const { productName, price, category, emailAccount, passwordAccount, profileName, pin, additionalInfo } = body;

    if (typeof productName !== 'string' || !productName.trim() || typeof price !== 'number' || typeof emailAccount !== 'string' || !emailAccount.trim() || typeof passwordAccount !== 'string' || !passwordAccount) {
      return NextResponse.json(
        { success: false, message: 'Nama produk, harga, email, dan password wajib diisi dengan tipe yang benar.' },
        { status: 400 }
      );
    }

    const parsedPrice = Math.round(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      return NextResponse.json(
        { success: false, message: 'Harga harus berupa angka bulat positif.' },
        { status: 400 }
      );
    }

    const cleanName = productName.trim().slice(0, 100);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const cleanEmail = emailAccount.trim().slice(0, 150);
    const cleanProfile = typeof profileName === 'string' && profileName.trim() ? profileName.trim().slice(0, 50) : null;
    
    const stockSecret = process.env.CRON_SECRET || 'fallback_secret';
    const identityString = `${cleanName}:${cleanEmail}:${cleanProfile || ''}`;
    const fingerprint = crypto.createHmac('sha256', stockSecret).update(identityString).digest('hex');

    let product = await prisma.product.findFirst({
      where: { name: cleanName },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          name: cleanName,
          slug: `${slug}-${Date.now()}`,
          price: parsedPrice,
          category: typeof category === 'string' && category.trim() ? category.trim().slice(0, 50) : 'Apps Premium',
        },
      });
    }

    const encryptedPassword = encryptData(passwordAccount);
    const encryptedEmail = encryptData(cleanEmail);
    const encryptedPin = typeof pin === 'string' && pin.trim() ? encryptData(pin.trim().slice(0, 20)) : null;
    const encryptedAdditionalInfo = typeof additionalInfo === 'string' && additionalInfo.trim() ? encryptData(additionalInfo.trim().slice(0, 500)) : null;

    // Optional: catch Prisma unique constraint violation to return 409 Conflict
    let newStock;
    try {
      newStock = await prisma.accountStock.create({
        data: {
          productId: product.id,
          emailAccount: encryptedEmail,
          passwordAccount: encryptedPassword,
          profileName: cleanProfile,
          pin: encryptedPin,
          additionalInfo: encryptedAdditionalInfo,
          fingerprint,
          status: 'READY',
        },
      });
    } catch (e: unknown) {
      if (typeof e === 'object' && e !== null && 'code' in e && (e as { code: string }).code === 'P2002') {
        return NextResponse.json({ success: false, message: 'Stok duplikat terdeteksi.' }, { status: 409 });
      }
      throw e;
    }

    return NextResponse.json({
      success: true,
      message: 'Stok berhasil ditambahkan!',
      data: newStock,
    });
  } catch (error: unknown) {
    console.error('Error add stock:', error);
    return NextResponse.json({ success: false, message: 'Gagal menyimpan stok akun.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    if (!(await verifyAdminAuth(req))) {
      return NextResponse.json({ success: false, message: 'Akses ditolak (Unauthorized).' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10) || 50;
    const cursorStr = searchParams.get('cursor');
    const cursor = cursorStr ? parseInt(cursorStr, 10) : null;

    const stocks = await prisma.accountStock.findMany({
      take: limit + 1,
      ...(cursor && !isNaN(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        productId: true,
        profileName: true,
        status: true,
        emailAccount: true,
        passwordAccount: true,
        pin: true,
        additionalInfo: true,
        createdAt: true,
        product: { select: { name: true, price: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let nextCursor: number | null = null;
    if (stocks.length > limit) {
      const nextItem = stocks.pop();
      nextCursor = nextItem!.id;
    }

    const decryptedStocks = stocks.map(stock => ({
      ...stock,
      emailAccount: safeDecrypt(stock.emailAccount),
      passwordAccount: safeDecrypt(stock.passwordAccount),
      pin: stock.pin ? safeDecrypt(stock.pin) : null,
      additionalInfo: stock.additionalInfo ? safeDecrypt(stock.additionalInfo) : null,
    }));

    return NextResponse.json({ success: true, data: decryptedStocks, pagination: { nextCursor } });
  } catch (error: unknown) {
    console.error('Error fetch stocks:', error);
    return NextResponse.json({ success: false, message: 'Gagal memuat data stok.' }, { status: 500 });
  }
}