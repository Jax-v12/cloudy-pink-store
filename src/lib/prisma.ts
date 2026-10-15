import { PrismaClient } from '@prisma/client';
import { databaseTlsUrl } from './databaseTls';
import { createHash } from 'node:crypto';

export function assertSafeDatabaseUrl(urlStr?: string, env: NodeJS.ProcessEnv = process.env): void {
  if (!urlStr || typeof urlStr !== 'string' || !urlStr.trim()) {
    throw new Error('FATAL: DATABASE_URL is missing or empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    throw new Error('FATAL: DATABASE_URL is malformed.');
  }

  if (parsed.protocol !== 'mysql:') {
    throw new Error(`FATAL: Database protocol must be mysql:, got ${parsed.protocol}`);
  }

  const host = parsed.hostname.toLowerCase();
  if (!host) {
    throw new Error('FATAL: Database host is missing.');
  }

  const rawPath = parsed.pathname.replace(/^\/+/, '').split('?')[0].split('/')[0];
  if (!rawPath) {
    throw new Error('FATAL: Database name is missing in DATABASE_URL.');
  }

  let decodedName = rawPath;
  try {
    for (let i = 0; i < 5; i++) {
      const prev = decodedName;
      decodedName = decodeURIComponent(decodedName);
      if (decodedName === prev) break;
    }
  } catch {
    throw new Error('FATAL: Database name has invalid URL encoding.');
  }

  const dbName = decodedName.toLowerCase();

  let decodedUrl = urlStr;
  try {
    for (let i = 0; i < 5; i++) {
      const prev = decodedUrl;
      decodedUrl = decodeURIComponent(decodedUrl);
      if (decodedUrl === prev) break;
    }
  } catch {
    // If full URL decoding encounters formatting issues, pathname check still guards
  }

  const lowerDecodedUrl = decodedUrl.toLowerCase();

  // Explicit, fail-closed production identification.
  // NODE_ENV === 'production' is NOT sufficient (Vercel Preview also runs a production build).
  // Production requires exact VERCEL === '1' and VERCEL_ENV === 'production'.
  const isVercelProduction = env.VERCEL === '1' && env.VERCEL_ENV === 'production';

  const isAiven = host === 'aivencloud.com' || host.endsWith('.aivencloud.com');
  const isLocal = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);

  // Connection attempts targeting defaultdb outside of verified Vercel Production are strictly blocked
  // across all variations (plain, URL-encoded, parameter injections).
  const targetsDefaultDb =
    dbName === 'defaultdb' ||
    dbName.includes('defaultdb') ||
    lowerDecodedUrl.includes('/defaultdb') ||
    lowerDecodedUrl.includes('database=defaultdb');

  if (targetsDefaultDb && !isVercelProduction) {
    throw new Error('FATAL: Connection to defaultdb is strictly blocked outside of verified production.');
  }

  if (isVercelProduction) {
    if (!isAiven) {
      throw new Error(`FATAL: Production database must be hosted on Aiven, got ${host}.`);
    }
    if (dbName !== 'defaultdb') {
      throw new Error(`FATAL: Only defaultdb is permitted on Aiven in production, got ${dbName}.`);
    }
    if (parsed.searchParams.has('database') && parsed.searchParams.get('database')?.toLowerCase() !== 'defaultdb') {
      throw new Error('FATAL: Database query parameter mismatch in production DATABASE_URL.');
    }
    return;
  }

  if (isAiven) {
    if (dbName !== 'cloudy_staging') {
      throw new Error(`FATAL: Only cloudy_staging is permitted on Aiven outside production, got ${dbName}.`);
    }
    return;
  }

  if (isLocal) {
    if (!/^cloudy_test(?:_[a-z0-9_]+)?$/.test(dbName)) {
      throw new Error(`FATAL: Only cloudy_test_* databases are permitted on local hosts, got ${dbName}.`);
    }
    return;
  }

  throw new Error(`FATAL: Unauthorized database host: ${host}`);
}

// Enforce fail-closed validation on startup / module evaluation whenever DATABASE_URL is present
// or when running in runtime environments (production, Next.js build/runtime).
if (process.env.DATABASE_URL !== undefined || process.env.NODE_ENV === 'production' || process.env.NEXT_RUNTIME) {
  assertSafeDatabaseUrl(process.env.DATABASE_URL);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient; prismaConfigHash?: string };
const configHash = createHash('sha256').update([
  process.env.DATABASE_URL, process.env.DATABASE_CA_CERT_BASE64, process.env.DATABASE_CA_CERT_PATH,
].join('\0')).digest('hex');
// Hot reload must never silently retain a client created before TLS/config changed.
if (globalForPrisma.prisma && '$connect' in globalForPrisma.prisma && globalForPrisma.prismaConfigHash !== configHash) {
  throw new Error('DATABASE_CONFIG_RESTART_REQUIRED');
}

export const prisma =
  globalForPrisma.prisma ||
  (() => {
    assertSafeDatabaseUrl(process.env.DATABASE_URL);
    return new PrismaClient({
      datasources: { db: { url: databaseTlsUrl(process.env.DATABASE_URL!) } },
      // Route-level logging emits safe error codes, never Prisma query arguments.
      log: [],
    });
  })();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaConfigHash = configHash;
}
