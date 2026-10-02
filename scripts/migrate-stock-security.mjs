// Node 24+. Dry-run by default. Pause inventory writes before --apply.
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { encryptData, decryptData, decryptLegacyField } from '../src/lib/crypto.ts';

const prisma = new PrismaClient({ log: [] });
const apply = process.argv.includes('--apply');
const key = process.env.STOCK_FINGERPRINT_KEY || process.env.CRON_SECRET;
let cursor = 0;
try {
  if (!key?.trim() || !process.env.ENCRYPTION_KEY?.trim()) throw new Error('MIGRATION_KEYS_REQUIRED');
  const identities = new Map();
  const plans = [];
  for (;;) {
    const rows = await prisma.accountStock.findMany({ where: { id: { gt: cursor } }, take: 200, orderBy: { id: 'asc' } });
    if (!rows.length) break;
    for (const row of rows) {
      // Passwords already used GCM. Stop on corruption or wrong keys; do not guess.
      decryptData(row.passwordAccount);
      const email = decryptLegacyField(row.emailAccount);
      const fingerprint = crypto.createHmac('sha256', key)
        .update(JSON.stringify([row.productId, email.trim().toLowerCase(), row.profileName || '']))
        .digest('hex');
      if (identities.has(fingerprint)) {
        console.error('Duplicate stock IDs require manual review:', identities.get(fingerprint), row.id);
        throw new Error('DUPLICATE_STOCK_IDENTITY');
      }
      identities.set(fingerprint, row.id);
      const encryptLegacy = value => {
        if (value === null) return null;
        const plain = decryptLegacyField(value);
        return /^[a-f\d]{32}:/i.test(value) ? value : encryptData(plain);
      };
      plans.push({ id: row.id, data: { fingerprint, emailAccount: encryptLegacy(row.emailAccount), pin: encryptLegacy(row.pin), additionalInfo: encryptLegacy(row.additionalInfo) } });
    }
    cursor = rows.at(-1).id;
  }
  console.log('Validated stock rows:', plans.length);
  if (apply) {
    for (let offset = 0; offset < plans.length; offset += 100) {
      await prisma.$transaction(plans.slice(offset, offset + 100).map(plan => prisma.accountStock.update({ where: { id: plan.id }, data: plan.data })));
    }
    console.log('Credential and fingerprint migration completed.');
  } else {
    console.log('Dry run only. No rows changed. Use --apply after checking the backup and maintenance window.');
  }
} catch {
  // Do not print Prisma errors or credential payloads.
  console.error('Migration stopped. Check configuration, duplicate IDs, and encryption compatibility before retrying.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
