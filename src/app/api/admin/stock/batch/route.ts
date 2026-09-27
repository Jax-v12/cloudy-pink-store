import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { encryptData } from '@/lib/crypto';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Reusable admin auth verification (SHA-256)
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

interface BatchStockItem {
  emailAccount: string;
  passwordAccount: string;
  profileName?: string | null;
  pin?: string | null;
}

interface BatchRequestBody {
  productName: string;
  price: number;
  category?: string;
  stocks: BatchStockItem[];
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    if (!verifyAdminAuth(req, cookieStore)) {
      return NextResponse.json({ success: false, message: 'Akses ditolak (Unauthorized).' }, { status: 401 });
    }

    const body = (await req.json()) as BatchRequestBody;
    const { productName, price, category, stocks } = body;

    // Validate required fields
    if (!productName || !price || !Array.isArray(stocks) || stocks.length === 0) {
      return NextResponse.json(
        { success: false, message: 'productName, price, dan stocks[] wajib diisi.' },
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

    // Validate all stock entries before touching DB
    for (let i = 0; i < stocks.length; i++) {
      const item = stocks[i];
      if (!item.emailAccount || !item.passwordAccount) {
        return NextResponse.json(
          { success: false, message: `Item ke-${i + 1} tidak valid: emailAccount dan passwordAccount wajib ada.` },
          { status: 400 }
        );
      }
    }

    // Encrypt all passwords BEFORE the transaction (CPU-bound work outside DB lock)
    const encryptedStocks = stocks.map((item) => ({
      emailAccount: String(item.emailAccount).trim().slice(0, 150),
      passwordAccount: encryptData(String(item.passwordAccount)),
      profileName: item.profileName ? String(item.profileName).trim().slice(0, 50) : null,
      pin: item.pin ? String(item.pin).trim().slice(0, 20) : null,
    }));

    // Atomic transaction: upsert product + batch insert stocks
    const result = await prisma.$transaction(async (tx) => {
      const cleanName = String(productName).trim().slice(0, 100);
      const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

      // Find or create product
      let product = await tx.product.findFirst({ where: { name: cleanName } });
      if (!product) {
        product = await tx.product.create({
          data: {
            name: cleanName,
            slug: `${slug}-${Date.now()}`,
            price: parsedPrice,
            category: category ? String(category).trim().slice(0, 50) : 'Apps Premium',
          },
        });
      }

      // Batch insert all stocks atomically
      const createResult = await tx.accountStock.createMany({
        data: encryptedStocks.map((s) => ({
          productId: product!.id,
          emailAccount: s.emailAccount,
          passwordAccount: s.passwordAccount,
          profileName: s.profileName,
          pin: s.pin,
          status: 'READY',
        })),
        skipDuplicates: true,
      });

      return { productId: product.id, insertedCount: createResult.count };
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil menambahkan ${result.insertedCount} stok akun secara atomik.`,
      data: { productId: result.productId, insertedCount: result.insertedCount },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Gagal memproses batch stok.';
    console.error('[Batch Stock] Error:', errMessage);
    return NextResponse.json({ success: false, message: errMessage }, { status: 500 });
  }
}
