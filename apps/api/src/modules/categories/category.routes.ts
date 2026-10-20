import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { listCategoriesController } from './category.controller.js';

export const categoryRouter: Router = Router();

categoryRouter.get('/', asyncHandler(listCategoriesController));
