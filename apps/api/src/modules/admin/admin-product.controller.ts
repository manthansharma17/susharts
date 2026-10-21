import type { Request, Response } from 'express';
import {
  adminProductListQuerySchema,
  createProductSchema,
  createVariantSchema,
  updateInventorySchema,
  updateProductSchema,
  updateVariantSchema,
} from '@susharts/shared';
import {
  adminArchiveProduct,
  adminCreateProduct,
  adminCreateVariant,
  adminDeleteVariant,
  adminGetProduct,
  adminListProducts,
  adminUpdateInventory,
  adminUpdateProduct,
  adminUpdateVariant,
} from './admin-product.service.js';
import { parseId } from './admin-params.js';

export async function listProductsController(req: Request, res: Response): Promise<void> {
  const query = adminProductListQuerySchema.parse(req.query);
  res.json(await adminListProducts(query));
}

export async function createProductController(req: Request, res: Response): Promise<void> {
  const input = createProductSchema.parse(req.body);
  const product = await adminCreateProduct(input);
  res.status(201).json(product);
}

export async function updateProductController(req: Request, res: Response): Promise<void> {
  const input = updateProductSchema.parse(req.body);
  const product = await adminUpdateProduct(parseId(req.params.id, 'Product'), input);
  res.json(product);
}

export async function archiveProductController(req: Request, res: Response): Promise<void> {
  await adminArchiveProduct(parseId(req.params.id, 'Product'));
  res.status(204).end();
}

export async function getAdminProductController(req: Request, res: Response): Promise<void> {
  const product = await adminGetProduct(parseId(req.params.id, 'Product'));
  res.json(product);
}

export async function createVariantController(req: Request, res: Response): Promise<void> {
  const input = createVariantSchema.parse(req.body);
  const variant = await adminCreateVariant(parseId(req.params.productId, 'Product'), input);
  res.status(201).json(variant);
}

export async function updateVariantController(req: Request, res: Response): Promise<void> {
  const input = updateVariantSchema.parse(req.body);
  const variant = await adminUpdateVariant(parseId(req.params.variantId, 'Variant'), input);
  res.json(variant);
}

export async function deleteVariantController(req: Request, res: Response): Promise<void> {
  await adminDeleteVariant(parseId(req.params.variantId, 'Variant'));
  res.status(204).end();
}

export async function updateInventoryController(req: Request, res: Response): Promise<void> {
  const input = updateInventorySchema.parse(req.body);
  const variant = await adminUpdateInventory(parseId(req.params.variantId, 'Variant'), input);
  res.json(variant);
}
