import type { Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  imageAltTextSchema,
  reorderImagesSchema,
  updateImageSchema,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';
import {
  adminDeleteImage,
  adminReorderImages,
  adminUpdateImage,
  adminUploadImage,
} from './admin-image.service.js';
import { parseId } from './admin-params.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 2 },
  fileFilter: (_req, file, cb) => {
    cb(null, (ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype));
  },
}).single('image');

/** Runs multer and turns its errors into the API's standard error responses. */
export const parseImageUpload: RequestHandler = (req, res, next) => {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(
          new HttpError(413, 'FILE_TOO_LARGE', `Image must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller`),
        );
        return;
      }
      next(HttpError.badRequest(`Invalid upload: ${err.message}`));
      return;
    }
    next(err);
  });
};

export async function uploadImageController(req: Request, res: Response): Promise<void> {
  const productId = parseId(req.params.productId, 'Product');
  if (!req.file) {
    throw HttpError.badRequest('An "image" file field of type JPEG, PNG, or WebP is required');
  }
  const altText = imageAltTextSchema.parse(req.body?.altText ?? null);
  const image = await adminUploadImage(productId, req.file, altText);
  res.status(201).json(image);
}

export async function updateImageController(req: Request, res: Response): Promise<void> {
  const imageId = parseId(req.params.imageId, 'Image');
  const input = updateImageSchema.parse(req.body);
  res.json(await adminUpdateImage(imageId, input));
}

export async function reorderImagesController(req: Request, res: Response): Promise<void> {
  const productId = parseId(req.params.productId, 'Product');
  const input = reorderImagesSchema.parse(req.body);
  res.json(await adminReorderImages(productId, input));
}

export async function deleteImageController(req: Request, res: Response): Promise<void> {
  const imageId = parseId(req.params.imageId, 'Image');
  await adminDeleteImage(imageId);
  res.status(204).end();
}
