import { z } from 'zod';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 10;

export const imageAltTextSchema = z
  .string()
  .trim()
  .max(200)
  .transform((v) => (v === '' ? null : v))
  .nullable();

export const updateImageSchema = z.object({ altText: imageAltTextSchema });
export type UpdateImageInput = z.infer<typeof updateImageSchema>;

export const reorderImagesSchema = z.object({
  imageIds: z.array(z.string().uuid()).min(1).max(MAX_IMAGES_PER_PRODUCT),
});
export type ReorderImagesInput = z.infer<typeof reorderImagesSchema>;
