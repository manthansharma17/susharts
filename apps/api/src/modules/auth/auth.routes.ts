import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { getMeController } from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.get('/me', requireAuth(), asyncHandler(getMeController));
