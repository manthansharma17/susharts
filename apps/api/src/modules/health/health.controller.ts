import type { Request, Response } from 'express';
import { getHealth } from './health.service.js';

export async function healthController(_req: Request, res: Response): Promise<void> {
  const health = await getHealth();
  res.status(health.status === 'ok' ? 200 : 503).json(health);
}
