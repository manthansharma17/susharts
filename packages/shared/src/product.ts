import { z } from 'zod';

// ──────────────────────────────────────────────
// Constants & literal types
// ──────────────────────────────────────────────

export const PRODUCT_CATEGORIES = ['PIPE_CLEANER', 'CROCHET'] as const;
export type ProductCategorySlug = (typeof PRODUCT_CATEGORIES)[number];

export const USER_ROLES = ['CUSTOMER', 'STAFF', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PRODUCT_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const FULFILLMENT_TYPES = ['READY_STOCK', 'MADE_TO_ORDER'] as const;
export type FulfillmentType = (typeof FULFILLMENT_TYPES)[number];

export const PRODUCT_SORT_FIELDS = ['createdAt', 'name', 'position', 'price'] as const;
export type ProductSortField = (typeof PRODUCT_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

// ──────────────────────────────────────────────
// Query schemas (used by both client and server)
// ──────────────────────────────────────────────

export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  search: z.string().max(200).optional(),
  sort: z.enum(PRODUCT_SORT_FIELDS).default('position'),
  order: z.enum(SORT_ORDERS).default('asc'),
  fulfillment: z.enum(FULFILLMENT_TYPES).optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export type ProductListQuery = z.infer<typeof productListQuerySchema>;

// ──────────────────────────────────────────────
// Response shapes (what the public API returns)
// ──────────────────────────────────────────────

export const productImageSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  altText: z.string().nullable(),
  position: z.number(),
});

export type ProductImage = z.infer<typeof productImageSchema>;

export const productVariantSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  sku: z.string(),
  priceInPaise: z.number().int(),
  compareAtPriceInPaise: z.number().int().nullable(),
  stockQuantity: z.number().int().nullable(),
  isAvailable: z.boolean(),
  position: z.number(),
});

export type ProductVariant = z.infer<typeof productVariantSchema>;

export const productSummarySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  shortDescription: z.string().nullable(),
  status: z.enum(PRODUCT_STATUSES),
  fulfillmentType: z.enum(FULFILLMENT_TYPES),
  categoryId: z.string().uuid(),
  heroImage: productImageSchema.nullable(),
  /** Lowest variant price in paise for display in listings. */
  minPriceInPaise: z.number().int(),
  /** Whether any variant is available. */
  isAvailable: z.boolean(),
  createdAt: z.string().datetime(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const productDetailSchema = productSummarySchema.extend({
  description: z.string().nullable(),
  productionDays: z.number().int().nullable(),
  metaTitle: z.string().nullable(),
  metaDescription: z.string().nullable(),
  category: z.object({
    id: z.string().uuid(),
    slug: z.string(),
    name: z.string(),
    parent: z.object({ id: z.string().uuid(), slug: z.string(), name: z.string() }).nullable(),
  }),
  variants: z.array(productVariantSchema),
  images: z.array(productImageSchema),
});

export type ProductDetail = z.infer<typeof productDetailSchema>;

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      totalPages: z.number().int(),
    }),
  });

export const productListResponseSchema = paginatedResponseSchema(productSummarySchema);
export type ProductListResponse = z.infer<typeof productListResponseSchema>;

// ──────────────────────────────────────────────
// Category response shapes
// ──────────────────────────────────────────────

export const categorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  position: z.number(),
});

export type CategoryResponse = z.infer<typeof categorySchema>;

export const categoryTreeNodeSchema = categorySchema.extend({
  children: z.array(categorySchema),
});

export type CategoryTreeNode = z.infer<typeof categoryTreeNodeSchema>;
