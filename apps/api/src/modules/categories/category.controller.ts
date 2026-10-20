import type { Request, Response } from 'express';
import { getCategoryTree } from './category.service.js';

export async function listCategoriesController(_req: Request, res: Response): Promise<void> {
  const tree = await getCategoryTree();
  res.json(tree);
}
