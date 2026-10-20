import { prisma } from '@susharts/db';
import type { HealthResponse } from '@susharts/shared';
import { logger } from '../../lib/logger.js';

export async function getHealth(): Promise<HealthResponse> {
  let database: HealthResponse['checks']['database'] = 'down';
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = 'up';
  } catch (err) {
    logger.warn({ err }, 'Database health check failed');
  }

  return {
    status: database === 'up' ? 'ok' : 'degraded',
    uptimeSeconds: Math.round(process.uptime()),
    checks: { database },
  };
}
