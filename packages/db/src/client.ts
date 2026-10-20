import { PrismaClient } from '@prisma/client';

declare global {
  // Reused across hot reloads in development so we do not exhaust connections.
  // eslint-disable-next-line no-var
  var __susharts_prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__susharts_prisma__ ?? new PrismaClient({ log: ['warn', 'error'] });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__susharts_prisma__ = prisma;
}
