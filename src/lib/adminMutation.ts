import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { CommerceError } from './commerce';
import { InputError, logFailure } from './http';

export const adminTransactionOptions = {
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
  maxWait: 5000,
  timeout: 10000,
};

export function databaseCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' ? error.code : undefined;
}

// Only deadlocks/write conflicts have a known rollback and are automatically replayed.
// Lost connections and transaction API errors can have an ambiguous commit result.
export async function adminMutation<T>(operation: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const start = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, adminTransactionOptions);
    } catch (error) {
      const code = databaseCode(error);
      if (code && /^P\d{4}$/.test(code)) console.error('Admin mutation', operation, code, 'attempt', attempt + 1, 'durationMs', Date.now() - start);
      if (code === 'P2034' && attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 50 + Math.floor(Math.random() * 100)));
        continue;
      }
      throw error;
    }
  }
}

export function adminMutationError(error: unknown): unknown {
  if (['P2028', 'P1017', 'P1001', 'P1002', 'P1008', 'P2024', 'P2034'].includes(databaseCode(error) || '')) {
    logFailure('Admin database temporarily unavailable', error);
    return new CommerceError('DATABASE_UNAVAILABLE', 503);
  }
  return error;
}

// Revalidate after acquiring the resource lock, including on retries.
export async function requireCurrentSession(tx: Prisma.TransactionClient, sessionId: string, recent = false) {
  const session = await tx.adminSession.findUnique({ where: { id: sessionId } });
  const now = Date.now();
  if (!session || session.expiresAt.getTime() <= now) throw new CommerceError('UNAUTHORIZED', 401);
  if (recent && (!session.reauthenticatedAt || now - session.reauthenticatedAt.getTime() > 300_000)) throw new CommerceError('REAUTH_REQUIRED', 403);
}

export function expectedTimestamp(value: unknown): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) throw new InputError();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) throw new InputError();
  return date;
}
