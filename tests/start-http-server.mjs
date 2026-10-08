import { geoSecret, geoAudience } from './geo-fixture.mjs';
// Dedicated production-mode HTTP harness: localhost DB, dummy credentials, no upstream calls.
import assert from 'node:assert/strict';
import { mockRoblox } from './roblox-fixture.mjs';

const database = new URL(process.env.TEST_DATABASE_URL || 'mysql://root@127.0.0.1:33307/cloudy_test_commerce');
assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && /^\/cloudy_test_[a-z0-9_]+$/.test(database.pathname));
Object.assign(process.env, {
  DATABASE_URL: database.href, NODE_ENV: 'production', ADMIN_PASSWORD: 'isolated-http-test-password',
  ENCRYPTION_KEY: 'test-key', CHECKOUT_HASH_KEY: 'test-key', ROBLOX_CHECKOUT_ENABLED: 'true',
  MIDTRANS_SERVER_KEY: 'isolated-http-test-midtrans-key', TELEGRAM_BOT_TOKEN: '', TELEGRAM_CHAT_ID: '',
  APP_ORIGIN: 'http://127.0.0.1:3112', GEOIP_SOURCE: 'signed-ingress', GEOIP_INGRESS_SECRET: geoSecret, GEOIP_INGRESS_AUDIENCE: geoAudience,
});
mockRoblox(true);
process.argv = [process.execPath, 'next', 'start', '-H', '127.0.0.1', '-p', '3112'];
await import('next/dist/bin/next');
