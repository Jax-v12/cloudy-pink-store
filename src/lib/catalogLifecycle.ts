import type { Prisma, Product } from '@prisma/client';
import { adminMutation, requireCurrentSession } from './adminMutation';
import { CommerceError } from './commerce';

export function deletionEligibility(counts: { orders: number; stocks: number }) {
  const reasonCodes = [counts.orders > 0 ? 'PRODUCT_HAS_ORDERS' : null, counts.stocks > 0 ? 'PRODUCT_HAS_STOCK' : null].filter((code): code is string => code !== null);
  return { allowed: reasonCodes.length === 0, reasonCodes };
}

export async function catalogAudit(tx: Prisma.TransactionClient, product: Pick<Product, 'id' | 'name' | 'type'>, sessionId: string, action: string) {
  await tx.catalogAudit.create({ data: { productId: product.id, productName: product.name, productType: product.type, sessionId, action } });
}

async function lockedProduct(tx: Prisma.TransactionClient, id: number, sessionId: string, recent: boolean) {
  await tx.$queryRaw`SELECT id FROM \`Product\` WHERE id = ${id} FOR UPDATE`;
  await requireCurrentSession(tx, sessionId, recent);
  const product = await tx.product.findUnique({ where: { id } });
  if (!product) throw new CommerceError('PRODUCT_NOT_FOUND', 404);
  if (product.type === 'APPS') throw new CommerceError('PRODUCT_TYPE_UNSUPPORTED', 403);
  return product;
}

export async function deleteCatalogProduct(id: number, sessionId: string, confirmationName: string, expectedUpdatedAt: Date) {
  return adminMutation('delete-product', async tx => {
    const product = await lockedProduct(tx, id, sessionId, true);
    if (product.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new CommerceError('PRODUCT_CHANGED');
    if (confirmationName !== product.name) throw new CommerceError('CONFIRMATION_MISMATCH', 400);
    // Existence probes are bounded even for products with extensive history.
    if (await tx.order.findFirst({ where: { productId: id }, select: { id: true } })) throw new CommerceError('PRODUCT_HAS_ORDERS');
    if (await tx.accountStock.findFirst({ where: { productId: id }, select: { id: true } })) throw new CommerceError('PRODUCT_HAS_STOCK');
    await tx.regionalPrice.deleteMany({ where: { variant: { productId: id } } });
    await tx.productVariant.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
    await catalogAudit(tx, product, sessionId, 'product-deleted');
    return { id };
  });
}

export async function setCatalogProductActive(id: number, sessionId: string, active: boolean, expectedUpdatedAt: Date) {
  return adminMutation('product-active', async tx => {
    const product = await lockedProduct(tx, id, sessionId, false);
    if (product.active === active) return { ...product, changed: false };
    if (product.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new CommerceError('PRODUCT_CHANGED');
    const saved = await tx.product.update({ where: { id }, data: { active } });
    await catalogAudit(tx, saved, sessionId, active ? 'product-reactivated' : 'product-deactivated');
    return { ...saved, changed: true };
  });
}
