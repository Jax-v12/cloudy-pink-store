type Page<T> = { data: T[]; nextCursor: number | null };

/** Refresh the loaded depth using new cursors, so inserts cannot leave gaps. */
export async function refreshOrderPages<T extends { id: number }>(
  depth: number,
  fetchPage: (cursor?: number) => Promise<Page<T>>,
) {
  const rows: T[] = [], cursors: number[] = [], seen = new Set<number>();
  let cursor: number | undefined;
  let nextCursor: number | null = null;
  for (let page = 0; page < Math.max(1, depth); page++) {
    const result = await fetchPage(cursor);
    if (cursor !== undefined) cursors.push(cursor);
    for (const row of result.data) if (!seen.has(row.id)) { seen.add(row.id); rows.push(row); }
    nextCursor = result.nextCursor;
    if (nextCursor === null) break;
    if (cursor !== undefined && nextCursor >= cursor) throw new Error('INVALID_ORDER_CURSOR');
    cursor = nextCursor;
  }
  return { rows, cursors, nextCursor };
}
