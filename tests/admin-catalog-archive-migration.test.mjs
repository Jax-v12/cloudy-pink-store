import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const url = process.env.TEST_ARCHIVE_MIGRATION_DATABASE_URL;
test('archive migration preserves legacy orders and stock and restricts product deletion', { skip: !url }, async () => {
  const target = new URL(url);
  assert.ok(['127.0.0.1','localhost'].includes(target.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(target.pathname));
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  const migration = '202610090001_admin_catalog_archive';
  const apply = async name => {
    const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
    for (const statement of sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(s => s && s !== 'START TRANSACTION' && s !== 'COMMIT')) await prisma.$executeRawUnsafe(statement);
  };
  try {
    assert.equal((await prisma.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()`)[0].n, 0n);
    for (const name of readdirSync(new URL('../prisma/migrations/', import.meta.url)).filter(n => /^\d/.test(n) && n < migration).sort()) await apply(name);
    await prisma.$executeRaw`INSERT INTO Product (id, name, slug, price, updatedAt) VALUES (1, 'Legacy', 'legacy', 1000, NOW()), (2, 'Stock only', 'stock-only', 1000, NOW())`;
    await prisma.$executeRaw`INSERT INTO AccountStock (productId,emailAccount,passwordAccount,fingerprint,updatedAt) VALUES (2,'encrypted','encrypted','fixture',NOW())`;
    await prisma.$executeRaw`INSERT INTO \`Order\` (invoice,accessToken,customerEmail,totalAmount,status,expiresAt,productId,updatedAt) VALUES ('legacy-invoice','legacy-token','fixture@example.test',1000,'PAID',NOW(),1,NOW())`;
    const before = await prisma.$queryRaw`SELECT * FROM \`Order\``;
    await apply(migration);
    // A distinct prepared statement avoids cached pre-migration SELECT * metadata.
    const after = await prisma.$queryRaw`SELECT o.* FROM \`Order\` o`;
    const { archivedAt, ...original } = after[0];
    assert.equal(archivedAt, null); assert.deepEqual(original, before[0]);
    assert.equal(await prisma.accountStock.count(), 1);
    await assert.rejects(prisma.product.delete({ where: { id: 2 } }), e => e.code === 'P2003');
    assert.equal(await prisma.catalogAudit.count(), 0);
    const index = await prisma.$queryRaw`SHOW INDEX FROM \`Order\` WHERE Key_name = 'Order_type_archivedAt_id_idx'`;
    assert.equal(index.length, 3);
  } finally { await prisma.$disconnect(); }
});
