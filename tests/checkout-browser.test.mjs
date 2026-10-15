import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { checkoutLocator, ensureCheckoutSession, invoiceId, loginAttempt, loginRequest, storedFlow } from '../src/lib/checkoutBrowser.ts';

test('browser session coordination fails closed without IndexedDB and never issues HTTP', async () => {
  const previous = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('UNEXPECTED_NETWORK'); };
  try {
    await assert.rejects(checkoutLocator(), /CHECKOUT_STORAGE_UNAVAILABLE/);
    await assert.rejects(ensureCheckoutSession(), /CHECKOUT_STORAGE_UNAVAILABLE/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = previous; }
});
test('per-product sessionStorage accepts only public flow UUIDs, never corrupt-value fallback', () => {
  const values = new Map(); globalThis.sessionStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  try {
    const flow = crypto.randomUUID(); assert.equal(storedFlow(1), null); assert.equal(storedFlow(1, flow), flow);
    assert.equal(storedFlow(2), null);
    assert.throws(() => storedFlow(1, 'not-a-flow'), /CHECKOUT_STORAGE_UNAVAILABLE/);
    values.set('cloudy-login-flow:1', 'corrupt'); assert.throws(() => storedFlow(1), /CHECKOUT_STORAGE_UNAVAILABLE/);
    assert.equal(values.get('cloudy-login-flow:1'), 'corrupt');
  } finally { delete globalThis.sessionStorage; }
});
test('attempt DTO and invoice navigation validate runtime data and strip unrelated fields', () => {
  const data = { flowId: crypto.randomUUID(), productId: 1, variantId: 2, version: 0, outcome: 'NOT_COMMITTED', selectionLocked: false, expiresAt: new Date().toISOString(), customerEmail: 'synthetic@example.invalid' };
  const row = loginAttempt(data, 1); assert.equal('customerEmail' in row, false);
  for (const patch of [{ productId: 2 }, { flowId: 'x' }, { version: -1 }, { variantId: null }, { expiresAt: 'bad' }, { outcome: 'COMMITTED' }, { selectionLocked: null }]) assert.throws(() => loginAttempt({ ...data, ...patch }, 1), /CHECKOUT_UNKNOWN/);
  for (const id of ['javascript:alert(1)', '/order/other', 'INV-../secret', '', 'INV-' + 'a'.repeat(188)]) assert.equal(invoiceId(id), false);
  assert.equal(invoiceId('INV-fixture-1'), true);
});
test('malformed/ambiguous responses and sensitive error messages become a safe UNKNOWN', async () => {
  const previous = globalThis.fetch;
  try {
    for (const response of [() => { throw new Error('synthetic private payload'); }, () => Response.json({ success: false, errorCode: 'synthetic private payload' }, { status: 503 }), () => Response.json({ success: true }), () => new Response('not json')]) {
      globalThis.fetch = async () => response(); await assert.rejects(loginRequest('/fixture', {}), /^Error: CHECKOUT_UNKNOWN$/);
    }
    globalThis.fetch = async () => Response.json({ success: false, errorCode: 'CHECKOUT_SESSION_REQUIRED' }, { status: 401 });
    await assert.rejects(loginRequest('/fixture', {}), /CHECKOUT_SESSION_REQUIRED/);
  } finally { globalThis.fetch = previous; }
});
