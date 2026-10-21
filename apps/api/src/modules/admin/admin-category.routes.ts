import { prisma } from '@susharts/db';
import {
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
  type AdminCategory,
  type AdminCategoryNode,
  type CreateCategoryInput,
  type ReorderCategoriesInput,
  type UpdateCategoryInput,
} from '@susharts/shared';
import { Router } from 'express';
import { HttpError } from '../../lib/http-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { parseId } from './admin-params.js';

const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);

/** The storefront navigation is two levels deep, so a parent must itself be top-level. */
async function assertValidParent(parentId: string, childId?: string) {
  if (parentId === childId) throw HttpError.badRequest('A category cannot be inside itself');
  const parent = await prisma.category.findUnique({ where: { id: parentId } });
  if (!parent) throw HttpError.badRequest('Parent category not found');
  if (parent.parentId) throw HttpError.badRequest('Sub-categories cannot have their own sub-categories');
}

async function nextPosition(parentId: string | null): Promise<number> {
  const max = await prisma.category.aggregate({ where: { parentId }, _max: { position: true } });
  return max._max.position === null ? 0 : max._max.position + 1;
}

export async function adminListCategories(): Promise<AdminCategoryNode[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      parentId: true,
      slug: true,
      name: true,
      description: true,
      position: true,
      isArchived: true,
      _count: { select: { products: true } },
    },
  });
  const flat: AdminCategory[] = rows.map(({ _count, ...row }) => ({ ...row, productCount: _count.products }));
  return flat
    .filter((c) => c.parentId === null)
    .map((root) => ({ ...root, children: flat.filter((c) => c.parentId === root.id) }));
}

export async function adminCreateCategory(input: CreateCategoryInput) {
  if (input.parentId) await assertValidParent(input.parentId);
  return prisma.category.create({
    data: { ...input, position: await nextPosition(input.parentId) },
  });
}

export async function adminUpdateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!existing) throw HttpError.notFound('Category not found');

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) if (value !== undefined) data[key] = value;

  const moving = input.parentId !== undefined && input.parentId !== existing.parentId;
  if (moving) {
    if (input.parentId) {
      if (existing._count.children > 0) {
        throw HttpError.badRequest('Move or delete its sub-categories before placing this inside another category');
      }
      await assertValidParent(input.parentId, id);
    }
    data.position = await nextPosition(input.parentId ?? null);
  }

  return prisma.category.update({ where: { id }, data });
}

export async function adminReorderCategories(input: ReorderCategoriesInput) {
  const siblings = await prisma.category.findMany({ where: { parentId: input.parentId }, select: { id: true } });
  const current = new Set(siblings.map((s) => s.id));
  const requested = new Set(input.categoryIds);
  const sameSet =
    requested.size === input.categoryIds.length &&
    requested.size === current.size &&
    input.categoryIds.every((id) => current.has(id));
  if (!sameSet) {
    throw HttpError.badRequest('categoryIds must list every category at this level exactly once');
  }
  await prisma.$transaction(
    input.categoryIds.map((id, position) => prisma.category.update({ where: { id }, data: { position } })),
  );
}

export async function adminDeleteCategory(id: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { children: true, products: true } } },
  });
  if (!existing) throw HttpError.notFound('Category not found');
  if (existing._count.products > 0) {
    throw conflict(
      `This category has ${existing._count.products} product(s). Move them or archive the category instead.`,
    );
  }
  if (existing._count.children > 0) throw conflict('Delete or move its sub-categories first.');
  await prisma.category.delete({ where: { id } });
}

export const adminCategoryRouter: Router = Router();

adminCategoryRouter.use(requireAuth(), requireRole('ADMIN', 'STAFF'));

adminCategoryRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await adminListCategories());
  }),
);

adminCategoryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const input = createCategorySchema.parse(req.body);
    res.status(201).json(await adminCreateCategory(input));
  }),
);

adminCategoryRouter.put(
  '/order',
  asyncHandler(async (req, res) => {
    await adminReorderCategories(reorderCategoriesSchema.parse(req.body));
    res.status(204).end();
  }),
);

adminCategoryRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Category');
    const input = updateCategorySchema.parse(req.body);
    res.json(await adminUpdateCategory(id, input));
  }),
);

adminCategoryRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await adminDeleteCategory(parseId(req.params.id, 'Category'));
    res.status(204).end();
  }),
);
