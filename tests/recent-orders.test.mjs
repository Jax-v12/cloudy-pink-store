import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getRecentOrders, saveRecentOrder } from '../src/lib/recentOrders.ts';

describe('recentOrders', () => {
  let mockStorage = {};

  beforeEach(() => {
    mockStorage = {};
    global.window = {
      localStorage: {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, val) => { mockStorage[key] = String(val); },
      },
    };
  });

  it('saves and retrieves recent orders up to 5 items without duplicates', () => {
    assert.deepEqual(getRecentOrders(), []);

    saveRecentOrder({
      invoice: 'INV-1',
      productName: 'Netflix',
      type: 'APPS',
      status: 'PAID',
      createdAt: '2026-10-18T10:00:00.000Z',
    });

    saveRecentOrder({
      invoice: 'INV-2',
      productName: 'Spotify',
      type: 'APPS',
      status: 'PAID',
      createdAt: '2026-10-18T10:05:00.000Z',
    });

    let list = getRecentOrders();
    assert.equal(list.length, 2);
    assert.equal(list[0].invoice, 'INV-2'); // newest first
    assert.equal(list[1].invoice, 'INV-1');

    // Updating existing invoice should move it to top without duplicating
    saveRecentOrder({
      invoice: 'INV-1',
      productName: 'Netflix',
      type: 'APPS',
      status: 'PAID',
      createdAt: '2026-10-18T10:10:00.000Z',
    });

    list = getRecentOrders();
    assert.equal(list.length, 2);
    assert.equal(list[0].invoice, 'INV-1');
    assert.equal(list[1].invoice, 'INV-2');

    // Adding more items caps at 5
    for (let i = 3; i <= 8; i++) {
      saveRecentOrder({
        invoice: `INV-${i}`,
        productName: `App-${i}`,
        type: 'APPS',
        status: 'PAID',
        createdAt: '2026-10-18T10:00:00.000Z',
      });
    }

    list = getRecentOrders();
    assert.equal(list.length, 5);
    assert.equal(list[0].invoice, 'INV-8');
  });
});
