import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

const database = process.env.TEST_REMOVAL_MIGRATION_DATABASE_URL;
test('removal migration is additive and preserves existing active and archived financial records', { skip: !database }, async () => {
  const target = new URL(database);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(target.pathname));
  const prisma = new PrismaClient({ datasources: { db: { url: database } } });
  const migration = '20261010145353_add_removed_from_admin_at';
  const apply = async name => {
    const sql = readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');
    for (const statement of sql.replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(s => s && !['START TRANSACTION', 'COMMIT'].includes(s))) await prisma.$executeRawUnsafe(statement);
  };
  try {
    assert.equal((await prisma.$queryRaw`SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE()`)[0].n, 0n, 'Use a new disposable database');
    for (const name of readdirSync(new URL('../prisma/migrations/', import.meta.url)).filter(n => /^\d/.test(n) && n < migration).sort()) await apply(name);
    await prisma.$executeRaw`INSERT INTO Product (id,name,slug,price,updatedAt) VALUES (1,'Legacy','legacy',1000,NOW())`;
    await prisma.$executeRaw`INSERT INTO \`Order\` (id,invoice,accessToken,customerEmail,totalAmount,status,expiresAt,productId,updatedAt,archivedAt) VALUES (1,'active','token-1','fixture@example.test',1000,'PAID',NOW(),1,NOW(),NULL),(2,'archived','token-2','fixture@example.test',2000,'PAID',NOW(),1,NOW(),NOW())`;
    await prisma.$executeRaw`INSERT INTO AdminAudit (orderId,sessionId,action) VALUES (2,'historic-session','archive')`;
    const before = await prisma.$queryRaw`SELECT * FROM \`Order\` ORDER BY id`;
    const audits = await prisma.adminAudit.findMany();
    await apply(migration);
    const after = await prisma.order.findMany({ orderBy: { id: 'asc' } });
    assert.equal(after.length, 2);
    for (let i = 0; i < after.length; i++) {
      const { removedFromAdminAt, ...original } = after[i];
      assert.equal(removedFromAdminAt, null); assert.deepEqual(original, before[i]);
    }
    assert.deepEqual(await prisma.adminAudit.findMany(), audits);
    const indices = await prisma.$queryRaw`SHOW INDEX FROM \`Order\` WHERE Key_name IN ('Order_removedFromAdminAt_id_idx','Order_type_removedFromAdminAt_id_idx')`;
    assert.equal(indices.length, 5);
  } finally { await prisma.$disconnect(); }
});
