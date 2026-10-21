import { prisma } from '@susharts/db';
import type {
  AdminProductListQuery,
  AdminProductListResponse,
  CreateProductInput,
  CreateVariantInput,
  UpdateInventoryInput,
  UpdateProductInput,
  UpdateVariantInput,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export async function adminListProducts(
  query: AdminProductListQuery,
): Promise<AdminProductListResponse> {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { slug: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        slug: true,
        name: true,
        status: true,
        updatedAt: true,
        category: { select: { name: true } },
        images: { select: { url: true }, orderBy: { position: 'asc' }, take: 1 },
        variants: { select: { priceInPaise: true } },
        _count: { select: { images: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      categoryName: row.category.name,
      heroImageUrl: row.images[0]?.url ?? null,
      imageCount: row._count.images,
      variantCount: row.variants.length,
      minPriceInPaise: row.variants.length
        ? Math.min(...row.variants.map((v) => v.priceInPaise))
        : null,
      updatedAt: row.updatedAt.toISOString(),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function adminCreateProduct(input: CreateProductInput) {
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw HttpError.badRequest('Category not found');

  return prisma.product.create({
    data: input,
    include: { variants: true, images: true, category: true },
  });
}

export async function adminUpdateProduct(id: string, input: UpdateProductInput) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound('Product not found');

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw HttpError.badRequest('Category not found');
  }

  return prisma.product.update({
    where: { id },
    data: stripUndefined(input),
    include: { variants: true, images: true, category: true },
  });
}

export async function adminArchiveProduct(id: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw HttpError.notFound('Product not found');

  return prisma.product.update({
    where: { id },
    data: { status: 'ARCHIVED' },
  });
}

export async function adminGetProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { position: 'asc' } },
      images: { orderBy: { position: 'asc' } },
      category: { include: { parent: true } },
    },
  });
  if (!product) throw HttpError.notFound('Product not found');
  return product;
}

export async function adminCreateVariant(productId: string, input: CreateVariantInput) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw HttpError.notFound('Product not found');

  return prisma.productVariant.create({
    data: { ...input, productId },
  });
}

export async function adminUpdateVariant(variantId: string, input: UpdateVariantInput) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing) throw HttpError.notFound('Variant not found');

  return prisma.productVariant.update({
    where: { id: variantId },
    data: stripUndefined(input),
  });
}

export async function adminDeleteVariant(variantId: string) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing) throw HttpError.notFound('Variant not found');

  await prisma.productVariant.delete({ where: { id: variantId } });
}

export async function adminUpdateInventory(variantId: string, input: UpdateInventoryInput) {
  const existing = await prisma.productVariant.findUnique({ where: { id: variantId } });
  if (!existing) throw HttpError.notFound('Variant not found');

  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      stockQuantity: input.stockQuantity,
      ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
    },
  });
}
