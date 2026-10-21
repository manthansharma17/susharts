import { Router } from 'express';
import { adminCategoryRouter } from './modules/admin/admin-category.routes.js';
import { adminProductRouter } from './modules/admin/admin-product.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { categoryRouter } from './modules/categories/category.routes.js';
import { checkoutRouter } from './modules/checkout/checkout.routes.js';
import { healthRouter } from './modules/health/health.routes.js';
import { productRouter } from './modules/products/product.routes.js';

/** Single mount point for every versioned API module. */
export const apiRouter: Router = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/products', productRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/cart', cartRouter);
apiRouter.use('/checkout', checkoutRouter);
apiRouter.use('/admin/products', adminProductRouter);
apiRouter.use('/admin/categories', adminCategoryRouter);
