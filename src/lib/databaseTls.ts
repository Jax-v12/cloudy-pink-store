import { X509Certificate } from 'node:crypto';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type TrustEnvironment = NodeJS.ProcessEnv;

// Prisma 6 MySQL consumes sslaccept/sslcert; ssl-mode does not enable TLS.
export function databaseTlsUrl(databaseUrl: string, env: TrustEnvironment = process.env): string {
  const url = new URL(databaseUrl);
  if (!url.hostname.toLowerCase().endsWith('.aivencloud.com') && url.hostname.toLowerCase() !== 'aivencloud.com') return databaseUrl;
  const certificatePath = env.DATABASE_CA_CERT_PATH || url.searchParams.get('sslcert');
  if (!env.DATABASE_CA_CERT_BASE64 && (env.VERCEL || !certificatePath)) throw new Error('DATABASE_CA_REQUIRED');
  let pem: string;
  try {
    if (env.DATABASE_CA_CERT_BASE64) {
      const encoded = env.DATABASE_CA_CERT_BASE64;
      if (encoded.length > 32_768 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error();
      pem = Buffer.from(encoded, 'base64').toString('utf8');
    } else {
      if (!certificatePath || statSync(certificatePath).size > 24_576) throw new Error();
      pem = readFileSync(certificatePath, 'utf8');
    }
    if (!/^\s*-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(pem)) throw new Error();
    const ca = new X509Certificate(pem);
    if (!ca.ca || Date.parse(ca.validFrom) > Date.now() || Date.parse(ca.validTo) <= Date.now()) throw new Error();
  } catch { throw new Error('DATABASE_CA_INVALID'); }
  // A per-process private temp copy works with Vercel's read-only application bundle.
  const directory = mkdtempSync(path.join(tmpdir(), 'cloudy-db-ca-'));
  const filename = path.join(directory, 'ca.pem');
  writeFileSync(filename, pem, { mode: 0o600, flag: 'wx' });
  url.searchParams.delete('ssl-mode');
  url.searchParams.set('sslaccept', 'strict');
  url.searchParams.set('sslcert', filename);
  return url.href;
}
