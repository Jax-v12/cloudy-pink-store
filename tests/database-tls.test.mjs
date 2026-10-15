import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { databaseTlsUrl } from '../src/lib/databaseTls.ts';

const target = 'mysql://synthetic:synthetic@service.aivencloud.com:1234/cloudy_staging?connection_limit=3&sslaccept=accept_invalid_certs&ssl-mode=REQUIRED';
const pem = rootCertificates.find(value => {
  const cert = new X509Certificate(value);
  return cert.ca && Date.parse(cert.validTo) > Date.now() && Date.parse(cert.validFrom) < Date.now();
});

test('CA time validity, bounded input, missing files and private keys fail closed without leaking material', () => {
  const currentTime = Date.now;
  const ca = new X509Certificate(pem);
  try {
    for (const time of [Date.parse(ca.validFrom) - 1, Date.parse(ca.validTo)]) {
      Date.now = () => time;
      assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }), /^Error: DATABASE_CA_INVALID$/);
    }
  } finally { Date.now = currentTime; }
  for (const value of ['A'.repeat(32_769), Buffer.from(pem + '\n-----BEGIN PRIVATE KEY-----\nsynthetic\n-----END PRIVATE KEY-----').toString('base64')]) {
    assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: value }), /^Error: DATABASE_CA_INVALID$/);
  }
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: 'missing-synthetic-ca.pem' }), /^Error: DATABASE_CA_INVALID$/);
});
const base64 = Buffer.from(pem).toString('base64');

test('Aiven requires explicit trust without falling back to an ignored repository CA', () => {
  assert.throws(() => databaseTlsUrl(target, {}), /DATABASE_CA_REQUIRED/);
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: 'invalid' }), /DATABASE_CA_INVALID/);
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: Buffer.from('private or malformed material').toString('base64') }), /DATABASE_CA_INVALID/);
  assert.throws(() => databaseTlsUrl(target, { VERCEL: '1', DATABASE_CA_CERT_PATH: 'docs/ca.pem' }), /DATABASE_CA_REQUIRED/);
});

test('deployment CA materializes outside the repository and enforces Prisma certificate and hostname validation', () => {
  const url = new URL(databaseTlsUrl(target, { VERCEL: '1', DATABASE_CA_CERT_BASE64: base64 }));
  const certificate = url.searchParams.get('sslcert');
  try {
    assert.equal(url.hostname, 'service.aivencloud.com'); assert.equal(url.pathname, '/cloudy_staging');
    assert.equal(url.searchParams.get('sslaccept'), 'strict');
    assert.equal(url.searchParams.has('ssl-mode'), false);
    assert.equal(url.searchParams.get('connection_limit'), '3');
    assert.equal(fs.readFileSync(certificate, 'utf8'), pem);
    const relative = path.relative(process.cwd(), certificate);
    assert.equal(path.isAbsolute(relative) || relative.startsWith('..'), true);
    if (process.platform !== 'win32') assert.equal(fs.statSync(certificate).mode & 0o777, 0o600);
    const local = new URL(databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: certificate }));
    assert.equal(local.searchParams.get('sslaccept'), 'strict');
    fs.rmSync(path.dirname(local.searchParams.get('sslcert')), { recursive: true });
  } finally { fs.rmSync(path.dirname(certificate), { recursive: true }); }
});

test('isolated localhost databases keep their existing connection and do not require Aiven CA', () => {
  const local = 'mysql://root@127.0.0.1:0/cloudy_test_tls';
  assert.equal(databaseTlsUrl(local, {}), local);
});

test('runtime refuses to reuse an unverified Prisma singleton after a configuration hot reload', () => {
  const child = spawnSync(process.execPath, ['--import', './tests/register.mjs', '--input-type=module', '-e', `
    import { PrismaClient } from '@prisma/client';
    globalThis.prisma = new PrismaClient();
    try { await import('./src/lib/prisma.ts'); process.exitCode = 1; }
    catch (error) { if (error.message !== 'DATABASE_CONFIG_RESTART_REQUIRED') process.exitCode = 2; }
    finally { await globalThis.prisma.$disconnect(); }
  `], { env: { ...process.env, DATABASE_URL: 'mysql://root@127.0.0.1:0/cloudy_test_tls' }, encoding: 'utf8' });
  assert.equal(child.status, 0, 'cached clients require a restart instead of silently retaining old trust');
});
