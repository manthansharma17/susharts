import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import {
  deleteImageController,
  parseImageUpload,
  reorderImagesController,
  updateImageController,
  uploadImageController,
} from './admin-image.controller.js';
import {
  archiveProductController,
  createProductController,
  createVariantController,
  deleteVariantController,
  getAdminProductController,
  listProductsController,
  updateInventoryController,
  updateProductController,
  updateVariantController,
} from './admin-product.controller.js';

export const adminProductRouter: Router = Router();

adminProductRouter.use(requireAuth(), requireRole('ADMIN', 'STAFF'));

adminProductRouter.get('/', asyncHandler(listProductsController));
adminProductRouter.post('/', asyncHandler(createProductController));
adminProductRouter.get('/:id', asyncHandler(getAdminProductController));
adminProductRouter.patch('/:id', asyncHandler(updateProductController));
adminProductRouter.post('/:id/archive', asyncHandler(archiveProductController));

adminProductRouter.post('/:productId/variants', asyncHandler(createVariantController));
adminProductRouter.patch('/variants/:variantId', asyncHandler(updateVariantController));
adminProductRouter.delete('/variants/:variantId', asyncHandler(deleteVariantController));
adminProductRouter.patch(
  '/variants/:variantId/inventory',
  asyncHandler(updateInventoryController),
);

adminProductRouter.post(
  '/:productId/images',
  parseImageUpload,
  asyncHandler(uploadImageController),
);
adminProductRouter.put('/:productId/images/order', asyncHandler(reorderImagesController));
adminProductRouter.patch('/images/:imageId', asyncHandler(updateImageController));
adminProductRouter.delete('/images/:imageId', asyncHandler(deleteImageController));
