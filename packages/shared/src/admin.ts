import { z } from 'zod';
import { FULFILLMENT_TYPES, PRODUCT_STATUSES } from './product.js';

export const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  shortDescription: z.string().max(300).nullable().default(null),
  description: z.string().nullable().default(null),
  categoryId: z.string().uuid(),
  status: z.enum(PRODUCT_STATUSES).default('DRAFT'),
  fulfillmentType: z.enum(FULFILLMENT_TYPES).default('READY_STOCK'),
  productionDays: z.number().int().positive().nullable().default(null),
  metaTitle: z.string().max(70).nullable().default(null),
  metaDescription: z.string().max(160).nullable().default(null),
  position: z.number().int().default(0),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const createVariantSchema = z.object({
  label: z.string().min(1).max(200).default('Default'),
  sku: z.string().min(1).max(100),
  priceInPaise: z.number().int().positive(),
  compareAtPriceInPaise: z.number().int().positive().nullable().default(null),
  stockQuantity: z.number().int().min(0).nullable().default(null),
  lowStockThreshold: z.number().int().min(0).default(5),
  position: z.number().int().default(0),
  isAvailable: z.boolean().default(true),
});

export type CreateVariantInput = z.infer<typeof createVariantSchema>;

export const updateVariantSchema = createVariantSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' },
);

export type UpdateVariantInput = z.infer<typeof updateVariantSchema>;

export const updateInventorySchema = z.object({
  stockQuantity: z.number().int().min(0).nullable(),
  isAvailable: z.boolean().optional(),
});

export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

export const adminProductListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  status: z.enum(PRODUCT_STATUSES).optional(),
});

export type AdminProductListQuery = z.infer<typeof adminProductListQuerySchema>;

export interface AdminProductListItem {
  id: string;
  slug: string;
  name: string;
  status: (typeof PRODUCT_STATUSES)[number];
  categoryName: string;
  heroImageUrl: string | null;
  imageCount: number;
  variantCount: number;
  minPriceInPaise: number | null;
  updatedAt: string;
}

export interface AdminProductListResponse {
  items: AdminProductListItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  parentId: z.string().uuid().nullable().default(null),
  description: z.string().trim().max(500).nullable().default(null),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    parentId: z.string().uuid().nullable(),
    description: z.string().trim().max(500).nullable(),
    isArchived: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' });

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const reorderCategoriesSchema = z.object({
  parentId: z.string().uuid().nullable(),
  categoryIds: z.array(z.string().uuid()).min(1).max(200),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;

export interface AdminCategory {
  id: string;
  parentId: string | null;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  isArchived: boolean;
  productCount: number;
}

export interface AdminCategoryNode extends AdminCategory {
  children: AdminCategory[];
}
