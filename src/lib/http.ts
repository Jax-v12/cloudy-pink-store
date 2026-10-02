export class InputError extends Error {
  constructor(public readonly status = 400) { super('INVALID_INPUT'); }
}

export const privateHeaders = { 'Cache-Control': 'private, no-store' };

/** Bound the actual stream, including requests without Content-Length. */
export async function readJson(req: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const reader = req.body?.getReader();
  if (!reader) throw new InputError();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new InputError(413);
      }
      chunks.push(value);
    }
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputError();
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError();
  } finally { reader.releaseLock(); }
}

export function positiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2_147_483_647;
}

export function textField(value: unknown, max: number, optional = false): string | null {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new InputError();
  return value.trim();
}

export function pagination(req: Request) {
  const params = new URL(req.url).searchParams;
  const rawLimit = params.get('limit') ?? '50';
  const rawCursor = params.get('cursor');
  if (!/^\d+$/.test(rawLimit) || (rawCursor !== null && !/^\d+$/.test(rawCursor))) throw new InputError();
  const limit = Number(rawLimit);
  const cursor = rawCursor === null ? null : Number(rawCursor);
  if (!positiveInt(limit) || limit > 100 || (cursor !== null && !positiveInt(cursor))) throw new InputError();
  return { limit, cursor };
}

export function pageResult<T extends { id: number }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit);
  return { data, pagination: { nextCursor: hasMore ? data.at(-1)!.id : null } };
}

/** Prisma messages can contain query arguments and credentials. */
export function logFailure(scope: string, error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const known = ['PAYMENT_REQUIRES_REVIEW', 'PAYMENT_TRANSITION_CONFLICT', 'STOCK_STATE_CONFLICT', 'MISSING_RESERVED_STOCK', 'GATEWAY_STATUS_UNVERIFIED', 'CLEANUP_REQUIRES_RETRY'];
  const reason = error instanceof Error && known.includes(error.message) ? error.message : 'INTERNAL_ERROR';
  console.error(scope, typeof code === 'string' && /^P\d{4}$/.test(code) ? code : reason);
}
