import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { stagingTarget, writeApproval, fixtureScope, guardedClient, isolatedEnvironment } from './sandbox-policy.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

export async function loadTarget() {
  let url;
  if (process.env.CLOUDY_STAGING_URL) url = stagingTarget(process.env.CLOUDY_STAGING_URL);
  else {
    const { parse } = await import('dotenv');
    const config = parse(fs.readFileSync(path.join(root, '.env')));
    try { url = new URL(config.DATABASE_URL); } catch { throw new Error('STAGING_CONFIG_INVALID'); }
    url.pathname = '/cloudy_staging';
    stagingTarget(url.href);
  }
  url.searchParams.delete('ssl-mode');
  url.searchParams.set('sslaccept', 'strict');
  const certPath = process.env.STAGING_CA_CERT || process.env.DATABASE_CA_CERT_PATH || path.join(root, 'docs/ca.pem');
  if (certPath) {
    const certificate = path.resolve(certPath);
    if (!fs.existsSync(certificate) || !fs.statSync(certificate).isFile()) throw new Error('STAGING_CA_CERT_INVALID');
    url.searchParams.set('sslcert', certificate);
  } else {
    throw new Error('STAGING_CA_CERT_REQUIRED');
  }
  return stagingTarget(url.href).href;
}

export async function preflight(raw) {
  const [identity] = await raw.$queryRaw`SELECT DATABASE() AS name, VERSION() AS version`;
  if (identity.name !== 'cloudy_staging' || identity.version !== '8.4.8') throw new Error('STAGING_IDENTITY_REJECTED');
  const tls = await raw.$queryRaw`SHOW SESSION STATUS LIKE 'Ssl_cipher'`;
  if (!tls[0]?.Value) throw new Error('STAGING_TLS_REQUIRED');
  const history = await raw.$queryRaw`SELECT migration_name, checksum, finished_at, rolled_back_at FROM \`_prisma_migrations\` ORDER BY migration_name`;
  const folder = path.join(root, 'prisma/migrations');
  const local = fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  if (history.length !== local.length || history.some((row, index) => row.migration_name !== local[index] || !row.finished_at || row.rolled_back_at || digest(fs.readFileSync(path.join(folder, local[index], 'migration.sql'))) !== row.checksum)) throw new Error('STAGING_MIGRATION_HISTORY_REJECTED');
  const columns = await raw.$queryRaw`SELECT TABLE_NAME, COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND ((TABLE_NAME='RobloxOrderDetail' AND COLUMN_NAME='whatsappE164') OR (TABLE_NAME IN ('CheckoutSession','CheckoutAttempt') AND COLUMN_NAME='id'))`;
  if (columns.length !== 3 || !columns.some(column => column.COLUMN_NAME === 'whatsappE164' && column.IS_NULLABLE === 'YES')) throw new Error('STAGING_SCHEMA_REQUIRED');

  // Verify Midtrans Sandbox configuration without logging secrets
  const { parse } = await import('dotenv');
  const envConfig = parse(fs.readFileSync(path.join(root, '.env')));
  const isProd = envConfig.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true' || envConfig.MIDTRANS_IS_PRODUCTION === 'true';
  if (isProd) throw new Error('SANDBOX_PRODUCTION_MODE_FORBIDDEN');
  const serverKey = envConfig.MIDTRANS_SERVER_KEY;
  if (!serverKey?.trim()) throw new Error('SANDBOX_SERVER_KEY_REQUIRED');

  // Probe Midtrans Sandbox API with probe status check
  const auth = Buffer.from(`${serverKey}:`).toString('base64');
  const probeResponse = await fetch('https://api.sandbox.midtrans.com/v2/INV-preflight-probe/status', {
    headers: { Authorization: `Basic ${auth}` },
    signal: AbortSignal.timeout(10_000),
  });
  const probeBody = await probeResponse.json().catch(() => null);
  if (!probeResponse.ok || probeBody?.status_code !== '404') {
    throw new Error('SANDBOX_AUTHENTICATION_FAILED');
  }

  return { target: 'VERIFIED', database: 'cloudy_staging', version: identity.version, encryptedConnection: true, appliedMigrations: history.length, pendingMigrations: 0, midtransSandboxVerified: true };
}

export function realClient(url) {
  if (stagingTarget(url).searchParams.get('sslaccept') !== 'strict') throw new Error('STAGING_STRICT_TLS_REQUIRED');
  return new PrismaClient({ datasourceUrl: url, log: [] });
}

export async function historicalFingerprint(raw, originalIds) {
  const count = await raw.$queryRaw`SELECT COUNT(*) AS n FROM \`Order\``;
  if (Number(count[0].n) > 500) throw new Error('STAGING_HISTORY_SAMPLE_BUDGET_EXCEEDED');
  const fields = await raw.$queryRaw`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='Order' ORDER BY ORDINAL_POSITION`;
  if (!fields.length || fields.some(field => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(field.COLUMN_NAME))) throw new Error('STAGING_HISTORY_SCHEMA_REJECTED');
  const columns = fields.map(field => '`' + field.COLUMN_NAME + '`').join(',');
  const rows = await raw.$queryRawUnsafe(`SELECT id, SHA2(CAST(JSON_ARRAY(${columns}) AS CHAR),256) AS digest FROM \`Order\` ORDER BY id`);
  return originalIds ? rows.filter(row => originalIds.has(row.id)) : rows;
}

export async function setupSandbox() {
  writeApproval(process.env.STAGING_RUN_ID, process.env.STAGING_WRITE_APPROVAL);
  const url = stagingTarget(process.env.DATABASE_URL).href;
  const raw = realClient(url);
  try {
    await preflight(raw);
    const scope = fixtureScope(process.env.STAGING_RUN_ID, true);
    const collision = await raw.product.count({ where: { slug: { startsWith: scope.namespace + '-' } } });
    if (collision) throw new Error('STAGING_NAMESPACE_ALREADY_EXISTS');
    const before = await historicalFingerprint(raw);
    const db = guardedClient(raw, scope);
    globalThis.prisma = db;

    const { parse } = await import('dotenv');
    const envConfig = parse(fs.readFileSync(path.join(root, '.env')));
    const serverKey = envConfig.MIDTRANS_SERVER_KEY;

    const environment = { ...isolatedEnvironment(process.env), DATABASE_URL: url, NODE_ENV: 'test' };
    for (const key of Object.keys(process.env)) delete process.env[key];
    Object.assign(process.env, environment);

    process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    process.env.CHECKOUT_HASH_KEY = crypto.randomBytes(32).toString('hex');
    process.env.MIDTRANS_SERVER_KEY = serverKey;
    process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION = 'false';
    process.env.MIDTRANS_IS_PRODUCTION = 'false';
    process.env.ROBLOX_CHECKOUT_ENABLED = 'true';
    process.env.APP_ORIGIN = 'https://staging-tests.invalid';
    process.env.TRUSTED_CLIENT_IP_HEADER = 'x-staging-test-source';

    let unexpectedFetch = false;
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async (input, init) => {
      const urlStr = String(input);
      if (scope.fetchGate) await scope.fetchGate();

      // Roblox stubs
      if (urlStr === 'https://users.roblox.com/v1/usernames/users' && JSON.parse(init?.body || '{}').usernames?.[0] === scope.username) {
        return Response.json({ data: [{ id: 42, name: scope.username, displayName: scope.username }] });
      }

      // Midtrans Sandbox Charge
      if (urlStr === 'https://api.sandbox.midtrans.com/v2/charge') {
        if (init?.method === 'POST') {
          if (scope.charges.length >= 6) throw new Error('SANDBOX_CHARGE_BUDGET_EXCEEDED');
          const body = JSON.parse(init.body || '{}');
          if (body.transaction_details?.gross_amount !== 1000) throw new Error('SANDBOX_CHARGE_AMOUNT_INVALID');
          const invoice = body.transaction_details?.order_id;
          if (!invoice || !scope.invoices.has(invoice)) throw new Error('SANDBOX_CHARGE_INVOICE_UNOWNED');
          scope.charges.push({ invoice, time: Date.now(), key: new Headers(init.headers).get('idempotency-key') });
          scope.journal?.();
        }
        return originalFetch(input, init);
      }

      // Midtrans Sandbox Status
      if (/^https:\/\/api\.sandbox\.midtrans\.com\/v2\/INV-[a-f\d-]{36}\/status$/.test(urlStr)) {
        return originalFetch(input, init);
      }

      // Midtrans Simulator
      if (urlStr.startsWith('https://simulator.sandbox.midtrans.com/')) {
        return originalFetch(input, init);
      }

      unexpectedFetch = true;
      throw new Error(`SANDBOX_EXTERNAL_REQUEST_FORBIDDEN: ${urlStr}`);
    };

    const journalDirectory = path.join(root, '.cache/staging-runs');
    fs.mkdirSync(journalDirectory, { recursive: true });
    scope.journal = () => fs.writeFileSync(path.join(journalDirectory, scope.runId + '.json'), JSON.stringify({
      runId: scope.runId, namespace: scope.namespace,
      ...Object.fromEntries(['products', 'variants', 'createdSessions', 'attempts', 'orders', 'rateLimits', 'fulfillmentJobs'].map(key => [key, [...scope[key]]])),
      chargesCount: scope.charges.length,
    }));

    return {
      db, scope,
      async finish() {
        try {
          scope.fetchGate = null;
          await db.$transaction(async tx => {
            if (scope.orders.size) await tx.order.updateMany({ where: { id: { in: [...scope.orders] }, productId: { in: [...scope.products] }, customerEmail: scope.email }, data: { status: 'CANCELLED', archivedAt: new Date(), removedFromAdminAt: new Date() } });
            if (scope.orders.size) {
              await tx.orderSecret.deleteMany({ where: { orderId: { in: [...scope.orders] } } });
              await tx.robloxOrderDetail.updateMany({ where: { orderId: { in: [...scope.orders] }, method: 'LOGIN' }, data: { whatsappE164: null } });
            }
            if (scope.fulfillmentJobs.size) await tx.fulfillmentJob.deleteMany({ where: { orderId: { in: [...scope.orders] } } });
            if (scope.attempts.size) await tx.checkoutAttempt.deleteMany({ where: { id: { in: [...scope.attempts] }, sessionId: { in: [...scope.createdSessions] }, productId: { in: [...scope.products] } } });
            if (scope.createdSessions.size) await tx.checkoutSession.deleteMany({ where: { id: { in: [...scope.createdSessions] }, tokenHash: { in: [...scope.hashes] } } });
            if (scope.rateLimits.size) await tx.rateLimit.deleteMany({ where: { id: { in: [...scope.rateLimits] } } });
            if (scope.variants.size) await tx.productVariant.updateMany({ where: { id: { in: [...scope.variants] }, productId: { in: [...scope.products] } }, data: { active: false } });
            if (scope.products.size) await tx.product.updateMany({ where: { id: { in: [...scope.products] }, slug: { startsWith: scope.namespace + '-' } }, data: { active: false } });
          }, { timeout: 15000 });
          const after = await historicalFingerprint(raw, new Set(before.map(row => row.id)));
          if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('STAGING_HISTORICAL_ORDERS_CHANGED');
          if (unexpectedFetch) throw new Error('SANDBOX_EXTERNAL_REQUEST_ATTEMPTED');
        } finally {
          scope.journal(); globalThis.fetch = originalFetch; delete globalThis.prisma; await raw.$disconnect();
        }
      },
    };
  } catch (error) { await raw.$disconnect(); throw error; }
}
