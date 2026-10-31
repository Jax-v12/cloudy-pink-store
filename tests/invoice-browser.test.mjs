import test from 'node:test';
import assert from 'node:assert/strict';
import { canPersistInvoiceAccess, rememberInvoiceAccess, readInvoiceAccess, hasPendingInvoiceAccess, persistInvoiceAccess } from '../src/lib/invoiceBrowser.ts';

test('invoice access survives a storage failure after successful checkout and retries persistence without another checkout', () => {
  const values = new Map();
  let blocked = false;
  globalThis.window = { localStorage: {
    getItem: key => values.get(key) ?? null,
    setItem(key, value) { if (blocked) throw new Error('QuotaExceededError'); values.set(key, value); },
    removeItem: key => values.delete(key),
  } };
  try {
    assert.equal(canPersistInvoiceAccess(), true);
    assert.equal(values.size, 0);
    blocked = true;
    assert.equal(rememberInvoiceAccess('INV-storage', 'synthetic-token'), false);
    assert.equal(readInvoiceAccess('INV-storage'), 'synthetic-token');
    assert.equal(hasPendingInvoiceAccess('INV-storage'), true);
    assert.equal(canPersistInvoiceAccess(), false);
    assert.equal(persistInvoiceAccess('INV-storage'), false);
    blocked = false;
    assert.equal(persistInvoiceAccess('INV-storage'), true);
    assert.equal(hasPendingInvoiceAccess('INV-storage'), false);
    assert.equal(readInvoiceAccess('INV-storage'), 'synthetic-token');
    assert.equal(values.get('token_INV-storage'), 'synthetic-token');
  } finally { delete globalThis.window; }
});

test('blocked browser storage fails the checkout preflight and does not block cookie-based invoice reads', () => {
  globalThis.window = Object.defineProperty({}, 'localStorage', { get() { throw new Error('SecurityError'); } });
  try {
    assert.equal(canPersistInvoiceAccess(), false);
    assert.equal(readInvoiceAccess('INV-cookie'), null);
    assert.equal(readInvoiceAccess('invalid'), null);
  } finally { delete globalThis.window; }
});

test('invoice locators and token bounds are checked before keeping access in memory', () => {
  assert.throws(() => rememberInvoiceAccess('', 'token'));
  assert.throws(() => rememberInvoiceAccess('x'.repeat(192), 'token'));
  assert.throws(() => rememberInvoiceAccess('INV-fixture', ''));
  assert.throws(() => rememberInvoiceAccess('INV-fixture', 'x'.repeat(129)));
  assert.equal(readInvoiceAccess('INV-fixture'), null);
});

test('legacy invoice access retains the server locator contract independently of Login DTO formatting', () => {
  const values = new Map([['token_legacy-order-1', 'synthetic-legacy-token']]);
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) } };
  try {
    assert.equal(readInvoiceAccess('legacy-order-1'), 'synthetic-legacy-token');
    assert.equal(rememberInvoiceAccess('legacy-order-2', 'synthetic-second-token'), true);
    assert.equal(readInvoiceAccess('legacy-order-2'), 'synthetic-second-token');
  } finally { delete globalThis.window; }
});
