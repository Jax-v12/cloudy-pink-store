import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Route-level logging emits safe error codes, never Prisma query arguments.
    log: [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
