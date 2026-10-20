import { prisma } from '@susharts/db';
import type { Prisma } from '@susharts/db';
import type {
  ProductDetail,
  ProductListQuery,
  ProductListResponse,
  ProductSummary,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';

// ──────────────────────────────────────────────
// Reusable select shapes
// ──────────────────────────────────────────────

const imageSelect = {
  id: true,
  url: true,
  altText: true,
  position: true,
} as const;

const variantSelect = {
  id: true,
  label: true,
  sku: true,
  priceInPaise: true,
  compareAtPriceInPaise: true,
  stockQuantity: true,
  isAvailable: true,
  position: true,
} as const;

// ──────────────────────────────────────────────
// Mapping helpers
// ──────────────────────────────────────────────

interface RawProductRow {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  fulfillmentType: string;
  categoryId: string;
  createdAt: Date;
  images: Array<{ id: string; url: string; altText: string | null; position: number }>;
  variants: Array<{
    id: string;
    label: string;
    sku: string;
    priceInPaise: number;
    compareAtPriceInPaise: number | null;
    stockQuantity: number | null;
    isAvailable: boolean;
    position: number;
  }>;
}

function toProductSummary(row: RawProductRow): ProductSummary {
  const sortedImages = [...row.images].sort((a, b) => a.position - b.position);
  const availableVariants = row.variants.filter((v) => v.isAvailable);
  const prices = availableVariants.map((v) => v.priceInPaise);

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    status: row.status as ProductSummary['status'],
    fulfillmentType: row.fulfillmentType as ProductSummary['fulfillmentType'],
    categoryId: row.categoryId,
    heroImage: sortedImages[0] ?? null,
    minPriceInPaise: prices.length > 0 ? Math.min(...prices) : 0,
    isAvailable: availableVariants.length > 0,
    createdAt: row.createdAt.toISOString(),
  };
}

// ──────────────────────────────────────────────
// Public queries
// ──────────────────────────────────────────────

export async function listProducts(query: ProductListQuery): Promise<ProductListResponse> {
  const { page, limit, category, search, sort, order, fulfillment, inStock } = query;

  const where: Prisma.ProductWhereInput = {
    status: 'ACTIVE',
  };

  if (category) {
    // Accept a category slug and match products in that category or any of its children.
    const cat = await prisma.category.findUnique({
      where: { slug: category },
      select: { id: true, children: { select: { id: true } } },
    });
    if (cat) {
      const categoryIds = [cat.id, ...cat.children.map((c) => c.id)];
      where.categoryId = { in: categoryIds };
    } else {
      // Unknown category slug → no results rather than an error.
      return { items: [], pagination: { page, limit, total: 0, totalPages: 0 } };
    }
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { shortDescription: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (fulfillment) {
    where.fulfillmentType = fulfillment;
  }

  if (inStock === true) {
    where.variants = { some: { isAvailable: true, stockQuantity: { gt: 0 } } };
  } else if (inStock === false) {
    // Show out-of-stock items only (useful for "notify me" listings).
    where.variants = { none: { isAvailable: true, stockQuantity: { gt: 0 } } };
  }

  // Build orderBy. For "price" we cannot order at the Prisma level because it
  // lives on variants; we sort in-memory after fetching (acceptable for ≤100
  // items per page). For other fields, Prisma handles it.
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    sort !== 'price' ? { [sort]: order } : { position: 'asc' };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: {
        id: true,
        slug: true,
        name: true,
        shortDescription: true,
        status: true,
        fulfillmentType: true,
        categoryId: true,
        createdAt: true,
        images: { select: imageSelect, orderBy: { position: 'asc' }, take: 1 },
        variants: { select: variantSelect, where: { isAvailable: true } },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const items = rows.map((r) => toProductSummary(r as unknown as RawProductRow));

  // In-memory sort for the "price" field.
  if (sort === 'price') {
    items.sort((a, b) =>
      order === 'asc'
        ? a.minPriceInPaise - b.minPriceInPaise
        : b.minPriceInPaise - a.minPriceInPaise,
    );
  }

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      status: true,
      fulfillmentType: true,
      categoryId: true,
      productionDays: true,
      metaTitle: true,
      metaDescription: true,
      createdAt: true,
      images: { select: imageSelect, orderBy: { position: 'asc' } },
      variants: { select: variantSelect, orderBy: { position: 'asc' } },
      category: {
        select: {
          id: true,
          slug: true,
          name: true,
          parent: { select: { id: true, slug: true, name: true } },
        },
      },
    },
  });

  if (!product || product.status !== 'ACTIVE') {
    throw HttpError.notFound('Product not found');
  }

  const summary = toProductSummary(product);

  return {
    ...summary,
    description: product.description,
    productionDays: product.productionDays,
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    category: product.category,
    variants: product.variants,
    images: product.images,
  };
}
