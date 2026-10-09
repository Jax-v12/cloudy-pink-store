import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// Must be a separate, empty test database: this test exercises the actual upgrade SQL.
const url = process.env.TEST_MIGRATION_DATABASE_URL;
test('regional migration preserves existing IDR orders and backfills their historical subtotal', { skip: !url }, async () => {
  const parsed = new URL(url);
  assert.ok(['127.0.0.1', 'localhost'].includes(parsed.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(parsed.pathname));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const migration = '202610070001_regional_pricing';
  async function apply(name) {
    const statements = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8').replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(s => s && s !== 'START TRANSACTION' && s !== 'COMMIT');
    for (const sql of statements) await prisma.$executeRawUnsafe(sql);
  }
  try {
    assert.equal((await prisma.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()`)[0].n, BigInt(0), 'Use a fresh isolated migration database');
    for (const name of readdirSync(new URL('../prisma/migrations/', import.meta.url)).filter(n => /^\d/.test(n) && n < migration).sort()) await apply(name);
    await prisma.$executeRaw`INSERT INTO Product (id, name, slug, price, updatedAt) VALUES (1, 'Legacy Apps', 'legacy-apps', 7000, NOW())`;
    await prisma.$executeRaw`INSERT INTO \`Order\` (invoice, accessToken, customerEmail, totalAmount, status, expiresAt, productId, updatedAt) VALUES ('INV-legacy', 'test-token', 'legacy@example.test', 7000, 'PAID', NOW(), 1, NOW())`;
    await apply(migration);
    const order = await prisma.order.findUnique({ where: { invoice: 'INV-legacy' }, select: { totalAmount: true, productSubtotal: true, currency: true, pricingRegion: true, paymentProvider: true, paymentFee: true, discount: true, status: true, accessToken: true } });
    assert.equal(order.totalAmount, 7000); assert.equal(order.productSubtotal, 7000);
    assert.equal(order.currency, 'IDR'); assert.equal(order.pricingRegion, 'ID'); assert.equal(order.paymentProvider, 'MIDTRANS');
    assert.equal(order.paymentFee, 0); assert.equal(order.discount, 0); assert.equal(order.status, 'PAID');
    assert.equal(order.accessToken, 'test-token'); assert.equal(await prisma.regionalPrice.count(), 0);
  } finally { await prisma.$disconnect(); }
});
