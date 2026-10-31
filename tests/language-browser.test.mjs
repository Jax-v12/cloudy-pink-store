import test from 'node:test';
import assert from 'node:assert/strict';
import { getBrowserLanguage, setBrowserLanguage, subscribeLanguage } from '../src/lib/languageBrowser.ts';

test('language remains usable with blocked storage reads and writes, then accepts another tab preference', () => {
  const events = new EventTarget();
  const values = new Map();
  let blocked = true;
  globalThis.window = Object.assign(events, { localStorage: {
    getItem(key) { if (blocked) throw new Error('SecurityError'); return values.get(key) ?? null; },
    setItem(key, value) { if (blocked) throw new Error('QuotaExceededError'); values.set(key, value); },
  } });
  let changes = 0;
  const unsubscribe = subscribeLanguage(() => changes++);
  try {
    assert.equal(getBrowserLanguage(), 'ID');
    setBrowserLanguage('MY');
    assert.equal(getBrowserLanguage(), 'MY');
    blocked = false;
    assert.equal(getBrowserLanguage(), 'MY');
    setBrowserLanguage('EN');
    assert.equal(values.get('store_lang'), 'EN');
    assert.equal(getBrowserLanguage(), 'EN');
    values.set('store_lang', 'ID');
    const event = Object.assign(new Event('storage'), { key: 'store_lang' });
    window.dispatchEvent(event);
    assert.equal(getBrowserLanguage(), 'ID');
    assert.equal(changes, 3);
  } finally { unsubscribe(); delete globalThis.window; }
});

test('language defaults safely when the localStorage getter itself is denied', () => {
  globalThis.window = Object.defineProperty(new EventTarget(), 'localStorage', { get() { throw new Error('SecurityError'); } });
  try {
    assert.equal(getBrowserLanguage(), 'ID');
    assert.doesNotThrow(() => setBrowserLanguage('ID'));
  } finally { delete globalThis.window; }
});
