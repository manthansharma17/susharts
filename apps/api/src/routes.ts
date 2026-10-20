import { Router } from 'express';
import { healthRouter } from './modules/health/health.routes.js';

/** Single mount point for every versioned API module. */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
