import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { encryptData } from '@/lib/crypto';
import crypto from 'crypto';
import { verifyAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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
    if (!(await verifyAdminAuth(req))) {
      return NextResponse.json({ success: false, message: 'Akses ditolak (Unauthorized).' }, { status: 401 });
    }

    let body: BatchRequestBody;
    try {
      body = (await req.json()) as BatchRequestBody;
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON format' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const { productName, price, category, stocks } = body;

    // Validate required fields
    if (typeof productName !== 'string' || !productName.trim() || typeof price !== 'number' || !Array.isArray(stocks) || stocks.length === 0) {
      return NextResponse.json(
        { success: false, message: 'productName, price, dan stocks[] wajib diisi dengan tipe yang benar.' },
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

    // Validate all stock entries before touching DB
    for (let i = 0; i < stocks.length; i++) {
      const item = stocks[i];
      if (!item || typeof item !== 'object') {
         return NextResponse.json({ success: false, message: `Item ke-${i + 1} tidak valid.` }, { status: 400 });
      }
      if (typeof item.emailAccount !== 'string' || !item.emailAccount.trim() || typeof item.passwordAccount !== 'string' || !item.passwordAccount) {
        return NextResponse.json(
          { success: false, message: `Item ke-${i + 1} tidak valid: emailAccount dan passwordAccount wajib ada dan berupa string.` },
          { status: 400 }
        );
      }
    }

    // Encrypt all passwords BEFORE the transaction (CPU-bound work outside DB lock)
    // Create fingerprint for each stock
    const cleanName = productName.trim().slice(0, 100);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const stockSecret = process.env.CRON_SECRET || 'fallback_secret'; // Or any secret

    const encryptedStocks = stocks.map((item) => {
      const cleanEmail = item.emailAccount.trim().slice(0, 150);
      const cleanProfile = item.profileName ? String(item.profileName).trim().slice(0, 50) : null;
      
      const identityString = `${cleanName}:${cleanEmail}:${cleanProfile || ''}`;
      const fingerprint = crypto.createHmac('sha256', stockSecret).update(identityString).digest('hex');

      return {
        emailAccount: cleanEmail,
        passwordAccount: encryptData(item.passwordAccount),
        profileName: cleanProfile,
        pin: item.pin ? String(item.pin).trim().slice(0, 20) : null,
        fingerprint,
      };
    });

    // Atomic transaction: upsert product + batch insert stocks
    const result = await prisma.$transaction(async (tx) => {
      // Find or create product
      let product = await tx.product.findFirst({ where: { name: cleanName } });
      if (!product) {
        product = await tx.product.create({
          data: {
            name: cleanName,
            slug: `${slug}-${Date.now()}`,
            price: parsedPrice,
            category: typeof category === 'string' && category.trim() ? category.trim().slice(0, 50) : 'Apps Premium',
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
          fingerprint: s.fingerprint,
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
    console.error('[Batch Stock] Error:', error);
    return NextResponse.json({ success: false, message: 'Gagal memproses batch stok.' }, { status: 500 });
  }
}
