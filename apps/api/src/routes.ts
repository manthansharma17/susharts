import { Router } from 'express';
import { categoryRouter } from './modules/categories/category.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { productRouter } from './modules/products/product.routes.js';

/** Single mount point for every versioned API module. */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/categories', categoryRouter);
