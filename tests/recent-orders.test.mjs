import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRecentOrders, saveRecentOrder, clearRecentOrders } from '../src/lib/recentOrders.ts';

describe('recentOrders', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.window = {
      localStorage: {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, val) => {
          mockStorage[key] = String(val);
        },
        removeItem: (key) => {
          delete mockStorage[key];
        },
      },
    };
  });

  it('stores only { invoice, visitedAt } up to 5 items without duplicates and strips extra fields', t => {
    t.mock.method(Date, 'now', () => Date.parse('2037-01-01T00:00:00.000Z'));
    const nowMs = Date.parse('2026-10-18T10:10:00.000Z');
    assert.deepEqual(getRecentOrders(nowMs), []);

    saveRecentOrder({
      invoice: 'INV-1',
      visitedAt: '2026-10-18T10:00:00.000Z',
    }, nowMs);

    saveRecentOrder({
      invoice: 'INV-2',
      visitedAt: '2026-10-18T10:05:00.000Z',
    }, nowMs);

    let list = getRecentOrders(nowMs);
    assert.equal(list.length, 2);
    assert.deepEqual(Object.keys(list[0]).sort(), ['invoice', 'visitedAt']);
    assert.equal(list[0].invoice, 'INV-2');
    assert.equal(list[1].invoice, 'INV-1');

    // Updating existing invoice moves it to top without duplicating
    saveRecentOrder({
      invoice: 'INV-1',
      visitedAt: '2026-10-18T10:09:00.000Z',
    }, nowMs);

    list = getRecentOrders(nowMs);
    assert.equal(list.length, 2);
    assert.equal(list[0].invoice, 'INV-1');
    assert.equal(list[1].invoice, 'INV-2');

    // Adding more items caps at 5
    for (let i = 3; i <= 8; i++) {
      saveRecentOrder({
        invoice: `INV-${i}`,
        visitedAt: '2026-10-18T10:09:30.000Z',
      }, nowMs);
    }

    list = getRecentOrders(nowMs);
    assert.equal(list.length, 5);
    assert.equal(list[0].invoice, 'INV-8');
  });

  it('filters out entries older than 30 days, malformed entries, and supports clearRecentOrders', () => {
    const nowMs = new Date('2026-10-18T12:00:00.000Z').getTime();
    const expiredIso = new Date(nowMs - 31 * 24 * 60 * 60 * 1000).toISOString();
    const freshIso = new Date(nowMs - 2 * 24 * 60 * 60 * 1000).toISOString();

    mockStorage['cloudy_recent_orders'] = JSON.stringify([
      { invoice: 'INV-EXPIRED', visitedAt: expiredIso },
      { invoice: 'bad space invoice', visitedAt: freshIso },
      { invoice: 'INV-LEGACY-NO-VISITED', createdAt: freshIso, productName: 'Netflix' },
      { invoice: 'INV-FRESH', visitedAt: freshIso, productName: 'ShouldBeStripped', status: 'PAID' },
    ]);

    const list = getRecentOrders(nowMs);
    assert.deepEqual(list, [{ invoice: 'INV-FRESH', visitedAt: freshIso }]);

    clearRecentOrders();
    assert.deepEqual(getRecentOrders(nowMs), []);
  });

  it('gracefully falls back when window.localStorage getter throws SecurityError', () => {
    const windowWithBlockedStorage = {};
    Object.defineProperty(windowWithBlockedStorage, 'localStorage', {
      get() {
        const err = new Error('Access is denied for this document.');
        err.name = 'SecurityError';
        throw err;
      },
    });
    global.window = windowWithBlockedStorage;

    assert.doesNotThrow(() => {
      assert.deepEqual(getRecentOrders(), []);
      saveRecentOrder({ invoice: 'INV-BLOCKED-1' }, Date.parse('2026-10-18T10:00:00.000Z'));
      clearRecentOrders();
    });
  });
});
