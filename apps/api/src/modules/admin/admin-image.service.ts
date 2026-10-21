import { randomUUID } from 'node:crypto';
import { prisma } from '@susharts/db';
import {
  MAX_IMAGES_PER_PRODUCT,
  type AllowedImageType,
  type ReorderImagesInput,
  type UpdateImageInput,
} from '@susharts/shared';
import {
  CLOUDINARY_ROOT_FOLDER,
  destroyImage,
  getCloudinaryConfig,
  publicIdFromUrl,
  uploadImage,
} from '../../lib/cloudinary.js';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';

/** Identifies the real format from file signature bytes; the client-sent MIME type is not trusted. */
export function detectImageType(buffer: Buffer): AllowedImageType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

async function deleteFromCloudinary(url: string): Promise<void> {
  try {
    const publicId = publicIdFromUrl(url, getCloudinaryConfig().cloudName);
    if (publicId) await destroyImage(publicId);
  } catch (err) {
    // The DB row is already gone; an orphaned asset is harmless and cleanable later.
    logger.warn({ err, url }, 'Failed to delete image from Cloudinary');
  }
}

export async function adminUploadImage(
  productId: string,
  file: { buffer: Buffer },
  altText: string | null,
) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw HttpError.notFound('Product not found');

  const type = detectImageType(file.buffer);
  if (!type) throw HttpError.badRequest('File must be a JPEG, PNG, or WebP image');

  const existing = await prisma.productImage.aggregate({
    where: { productId },
    _count: true,
    _max: { position: true },
  });
  if (existing._count >= MAX_IMAGES_PER_PRODUCT) {
    throw HttpError.badRequest(`A product can have at most ${MAX_IMAGES_PER_PRODUCT} images`);
  }

  const publicId = `${CLOUDINARY_ROOT_FOLDER}/products/${productId}/${randomUUID()}`;
  const { url } = await uploadImage(file.buffer, type, publicId);

  try {
    return await prisma.productImage.create({
      data: {
        productId,
        url,
        altText,
        position: existing._max.position === null ? 0 : existing._max.position + 1,
      },
    });
  } catch (err) {
    await deleteFromCloudinary(url);
    throw err;
  }
}

/** Swaps the file behind an image (e.g. after cropping), keeping its id, position, and alt text. */
export async function adminReplaceImage(imageId: string, file: { buffer: Buffer }) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw HttpError.notFound('Image not found');

  const type = detectImageType(file.buffer);
  if (!type) throw HttpError.badRequest('File must be a JPEG, PNG, or WebP image');

  const publicId = `${CLOUDINARY_ROOT_FOLDER}/products/${image.productId}/${randomUUID()}`;
  const { url } = await uploadImage(file.buffer, type, publicId);

  let updated;
  try {
    updated = await prisma.productImage.update({ where: { id: imageId }, data: { url } });
  } catch (err) {
    await deleteFromCloudinary(url);
    throw err;
  }
  await deleteFromCloudinary(image.url);
  return updated;
}

export async function adminUpdateImage(imageId: string, input: UpdateImageInput) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw HttpError.notFound('Image not found');

  return prisma.productImage.update({
    where: { id: imageId },
    data: { altText: input.altText },
  });
}

export async function adminReorderImages(productId: string, input: ReorderImagesInput) {
  const images = await prisma.productImage.findMany({
    where: { productId },
    select: { id: true },
  });
  if (images.length === 0) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw HttpError.notFound('Product not found');
  }

  const current = new Set(images.map((img) => img.id));
  const requested = new Set(input.imageIds);
  const sameSet =
    requested.size === input.imageIds.length &&
    requested.size === current.size &&
    input.imageIds.every((id) => current.has(id));
  if (!sameSet) {
    throw HttpError.badRequest("imageIds must list each of this product's images exactly once");
  }

  await prisma.$transaction(
    input.imageIds.map((id, position) =>
      prisma.productImage.update({ where: { id }, data: { position } }),
    ),
  );

  return prisma.productImage.findMany({ where: { productId }, orderBy: { position: 'asc' } });
}

export async function adminDeleteImage(imageId: string) {
  const image = await prisma.productImage.findUnique({ where: { id: imageId } });
  if (!image) throw HttpError.notFound('Image not found');

  await prisma.$transaction(async (tx) => {
    await tx.productImage.delete({ where: { id: imageId } });
    const remaining = await tx.productImage.findMany({
      where: { productId: image.productId },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });
    for (const [position, img] of remaining.entries()) {
      if (img.position !== position) {
        await tx.productImage.update({ where: { id: img.id }, data: { position } });
      }
    }
  });

  await deleteFromCloudinary(image.url);
}
