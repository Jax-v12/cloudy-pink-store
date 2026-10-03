import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { encryptData } from '@/lib/crypto';
import { InputError, positiveInt, textField } from '@/lib/http';

function parseStock(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError();
  const item = value as Record<string, unknown>;
  const email = textField(item.emailAccount, 150)!;
  if (typeof item.passwordAccount !== 'string' || !item.passwordAccount || item.passwordAccount.length > 4096) throw new InputError();
  const profile = textField(item.profileName, 50, true);
  const pin = textField(item.pin, 20, true);
  const info = textField(item.additionalInfo, 500, true);
  return { email, profile, password: item.passwordAccount, pin, info };
}

export function stockFingerprint(productId: number, email: string, profile: string | null): string {
  const key = process.env.STOCK_FINGERPRINT_KEY || process.env.CRON_SECRET;
  if (!key?.trim()) throw new Error('STOCK_FINGERPRINT_KEY_REQUIRED');
  return crypto.createHmac('sha256', key)
    .update(JSON.stringify([productId, email.trim().toLowerCase(), profile || '']))
    .digest('hex');
}

export async function addStocks(body: Record<string, unknown>, batch: boolean) {
  const name = textField(body.productName, 100)!;
  if (!positiveInt(body.price)) throw new InputError();
  if (body.productId !== undefined && !positiveInt(body.productId)) throw new InputError();
  const category = textField(body.category, 50, true) || 'Apps Premium';
  const items = batch ? body.stocks : [body];
  if (!Array.isArray(items) || !items.length || items.length > 200) throw new InputError();
  // Validate the complete batch before writes; encrypt before opening a transaction.
  const stocks = items.map(parseStock).map(item => ({
    ...item,
    emailAccount: encryptData(item.email), passwordAccount: encryptData(item.password),
    pinEncrypted: item.pin ? encryptData(item.pin) : null,
    infoEncrypted: item.info ? encryptData(item.info) : null,
  }));
  return prisma.$transaction(async tx => {
    let product = body.productId !== undefined
      ? await tx.product.findUnique({ where: { id: body.productId as number } })
      : await tx.product.findFirst({ where: { name, type: 'APPS' }, orderBy: { id: 'asc' } });
    if (!product && body.productId !== undefined) throw new InputError(404);
    if (!product) {
      // A deterministic unique slug makes simultaneous product creation conflict
      // instead of silently creating two products with the same name.
      const slug = `product-${crypto.createHash('sha256').update(name.toLowerCase()).digest('hex')}`;
      product = await tx.product.create({ data: { name, slug, price: body.price as number, category } });
    }
    if (product.type !== 'APPS') throw new InputError();
    const rows = stocks.map(item => ({
      productId: product.id, emailAccount: item.emailAccount, passwordAccount: item.passwordAccount,
      profileName: item.profile, pin: item.pinEncrypted, additionalInfo: item.infoEncrypted,
      fingerprint: stockFingerprint(product.id, item.email, item.profile), status: 'READY' as const,
    }));
    const result = await tx.accountStock.createMany({ data: rows, skipDuplicates: batch });
    return { productId: product.id, insertedCount: result.count };
  });
}
