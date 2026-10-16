import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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
const certificateFiles = new Set();
function certificatePath(url) {
  const filename = new URL(url).searchParams.get('sslcert');
  certificateFiles.add(filename);
  return filename;
}
after(() => {
  const directories = new Set();
  for (const filename of certificateFiles) {
    const directory = fs.realpathSync(path.dirname(filename));
    assert.equal(path.dirname(directory), fs.realpathSync(tmpdir()));
    assert.match(path.basename(directory), /^cloudy-db-ca-/);
    assert.equal(new X509Certificate(fs.readFileSync(filename)).ca, true);
    fs.unlinkSync(filename);
    directories.add(directory);
  }
  for (const directory of directories) fs.rmdirSync(directory);
});

test('repeated CA use and source changes reuse private materialization without duplicate directories', () => {
  const first = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }));
  const second = certificatePath(databaseTlsUrl(target, { VERCEL: '1', DATABASE_CA_CERT_BASE64: base64 }));
  const fromFile = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: first }));
  assert.equal(second, first);
  assert.equal(fromFile, first);
});

test('CA rotation uses a separate immutable file in the same private directory', () => {
  const rotatedPem = rootCertificates.find(value => {
    const cert = new X509Certificate(value);
    return value !== pem && cert.ca && Date.parse(cert.validTo) > Date.now() && Date.parse(cert.validFrom) < Date.now();
  });
  const first = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }));
  const rotated = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: Buffer.from(rotatedPem).toString('base64') }));
  assert.notEqual(rotated, first);
  assert.equal(path.dirname(rotated), path.dirname(first));
  assert.equal(fs.readFileSync(first, 'utf8'), pem);
  assert.equal(fs.readFileSync(rotated, 'utf8'), rotatedPem);
});

test('cached CA remains subject to certificate expiry and current trust configuration', () => {
  certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }));
  const currentTime = Date.now;
  try {
    Date.now = () => Date.parse(new X509Certificate(pem).validTo);
    assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }), /^Error: DATABASE_CA_INVALID$/);
  } finally { Date.now = currentTime; }
  assert.throws(() => databaseTlsUrl(target, {}), /^Error: DATABASE_CA_REQUIRED$/);
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: 'invalid' }), /^Error: DATABASE_CA_INVALID$/);
});

test('a changed source file is revalidated rather than trusting a cached source path', t => {
  const sourceDirectory = fs.mkdtempSync(path.join(tmpdir(), 'cloudy-db-ca-test-'));
  const source = path.join(sourceDirectory, 'source.pem');
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(sourceDirectory)), fs.realpathSync(tmpdir()));
    fs.unlinkSync(source);
    fs.rmdirSync(sourceDirectory);
  });
  fs.writeFileSync(source, pem);
  const first = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: source }));
  const rotatedPem = rootCertificates.find(value => {
    const cert = new X509Certificate(value);
    return value !== pem && cert.ca && Date.parse(cert.validTo) > Date.now() && Date.parse(cert.validFrom) < Date.now();
  });
  fs.writeFileSync(source, rotatedPem);
  const rotated = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: source }));
  assert.notEqual(rotated, first);
  assert.equal(fs.readFileSync(first, 'utf8'), pem);
  assert.equal(fs.readFileSync(rotated, 'utf8'), rotatedPem);
  fs.writeFileSync(source, 'invalid public CA');
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: source }), /^Error: DATABASE_CA_INVALID$/);
});

test('modified materialized CA files fail closed instead of silently reusing changed trust', () => {
  const filename = certificatePath(databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }));
  try {
    fs.writeFileSync(filename, 'modified public CA');
    assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: base64 }), /^Error: DATABASE_CA_INVALID$/);
  } finally { fs.writeFileSync(filename, pem); }
});

test('Aiven requires explicit trust without falling back to an ignored repository CA', () => {
  assert.throws(() => databaseTlsUrl(target, {}), /DATABASE_CA_REQUIRED/);
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: 'invalid' }), /DATABASE_CA_INVALID/);
  assert.throws(() => databaseTlsUrl(target, { DATABASE_CA_CERT_BASE64: Buffer.from('private or malformed material').toString('base64') }), /DATABASE_CA_INVALID/);
  assert.throws(() => databaseTlsUrl(target, { VERCEL: '1', DATABASE_CA_CERT_PATH: 'docs/ca.pem' }), /DATABASE_CA_REQUIRED/);
});

test('deployment CA materializes outside the repository and enforces Prisma certificate and hostname validation', () => {
  const url = new URL(databaseTlsUrl(target, { VERCEL: '1', DATABASE_CA_CERT_BASE64: base64 }));
  const certificate = certificatePath(url.href);
  assert.equal(url.hostname, 'service.aivencloud.com'); assert.equal(url.pathname, '/cloudy_staging');
  assert.equal(url.searchParams.get('sslaccept'), 'strict');
  assert.equal(url.searchParams.has('ssl-mode'), false);
  assert.equal(url.searchParams.get('connection_limit'), '3');
  assert.equal(fs.readFileSync(certificate, 'utf8'), pem);
  const relative = path.relative(process.cwd(), certificate);
  assert.equal(path.isAbsolute(relative) || relative.startsWith('..'), true);
  if (process.platform !== 'win32') assert.equal(fs.statSync(certificate).mode & 0o777, 0o600);
  const local = new URL(databaseTlsUrl(target, { DATABASE_CA_CERT_PATH: certificate }));
  certificatePath(local.href);
  assert.equal(local.searchParams.get('sslaccept'), 'strict');
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
