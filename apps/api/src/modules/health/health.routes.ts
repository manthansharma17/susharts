import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { healthController } from './health.controller.js';

export const healthRouter: Router = Router();

healthRouter.get('/', asyncHandler(healthController));
