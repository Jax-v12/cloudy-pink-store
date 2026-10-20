import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshOrderPages } from '../src/lib/adminOrderPages.ts';

test('refresh rebuilds cursor chain after inserts without losing a middle page', async () => {
  const source = Array.from({ length: 105 }, (_, i) => ({ id: 105 - i }));
  const calls = [];
  const result = await refreshOrderPages(2, async cursor => {
    calls.push(cursor);
    const remaining = source.filter(row => cursor === undefined || row.id < cursor);
    const data = remaining.slice(0, 50);
    return { data, nextCursor: remaining.length > 50 ? data.at(-1).id : null };
  });
  assert.deepEqual(calls, [undefined, 56]);
  assert.deepEqual(result.rows.map(row => row.id), source.slice(0, 100).map(row => row.id));
  assert.equal(result.nextCursor, 6);
  assert.deepEqual(result.cursors, [56]);
});

test('refresh stops at the end and rejects a failed page without publishing partial rows', async () => {
  let calls = 0;
  assert.deepEqual(await refreshOrderPages(3, async () => { calls++; return { data: [], nextCursor: null }; }), { rows: [], cursors: [], nextCursor: null });
  assert.equal(calls, 1);
  await assert.rejects(refreshOrderPages(2, async cursor => {
    if (cursor) throw new Error('UNAUTHORIZED');
    return { data: [{ id: 2 }], nextCursor: 2 };
  }), /UNAUTHORIZED/);
});
