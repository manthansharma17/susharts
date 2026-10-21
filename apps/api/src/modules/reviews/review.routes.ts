import { createReviewSchema, reviewListQuerySchema } from '@susharts/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  createReview,
  deleteOwnReview,
  listFeaturedReviews,
  listProductReviews,
  updateOwnReview,
} from './review.service.js';

function reviewIdParam(req: Request): string {
  const result = z.string().uuid().safeParse(req.params.id);
  if (!result.success) throw HttpError.notFound('Review not found');
  return result.data;
}

/** Reviews for a product. Public read; writing needs a signed-in verified buyer. */
export const productReviewRouter: Router = Router({ mergeParams: true });

productReviewRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const query = reviewListQuerySchema.parse(req.query);
    // `authenticate` runs globally, so req.user is set for signed-in visitors.
    res.json(await listProductReviews(req.params.slug!, query, req.user?.id ?? null));
  }),
);

productReviewRouter.post(
  '/',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const input = createReviewSchema.parse(req.body);
    res.status(201).json(await createReview(req.user!.id, req.params.slug!, input));
  }),
);

/** A customer's own review, by id. */
export const reviewRouter: Router = Router();

/** Public: recent positive reviews for the homepage. */
reviewRouter.get(
  '/featured',
  asyncHandler(async (req, res) => {
    const limit = z.coerce.number().int().min(1).max(12).default(6).parse(req.query.limit);
    res.json(await listFeaturedReviews(limit));
  }),
);

reviewRouter.use(requireAuth());

reviewRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const input = createReviewSchema.parse(req.body);
    res.json(await updateOwnReview(req.user!.id, reviewIdParam(req), input));
  }),
);

reviewRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await deleteOwnReview(req.user!.id, reviewIdParam(req));
    res.status(204).end();
  }),
);
