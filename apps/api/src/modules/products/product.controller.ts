import type { Request, Response } from 'express';
import { productListQuerySchema } from '@susharts/shared';
import { getProductBySlug, listProducts } from './product.service.js';

export async function listProductsController(req: Request, res: Response): Promise<void> {
  const query = productListQuerySchema.parse(req.query);
  const result = await listProducts(query);
  res.json(result);
}

export async function getProductController(req: Request, res: Response): Promise<void> {
  const { slug } = req.params;
  if (!slug) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Slug is required' } });
    return;
  }
  const product = await getProductBySlug(slug);
  res.json(product);
}
