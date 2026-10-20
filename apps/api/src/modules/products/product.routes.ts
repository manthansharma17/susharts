import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { getProductController, listProductsController } from './product.controller.js';

export const productRouter: Router = Router();

productRouter.get('/', asyncHandler(listProductsController));
productRouter.get('/:slug', asyncHandler(getProductController));
