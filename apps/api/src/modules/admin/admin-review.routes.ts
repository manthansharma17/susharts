import { adminReviewListQuerySchema, moderateReviewSchema } from '@susharts/shared';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { parseId } from './admin-params.js';
import {
  adminDeleteReview,
  adminListReviews,
  adminModerateReview,
} from './admin-review.service.js';

export const adminReviewRouter: Router = Router();

adminReviewRouter.use(requireAuth(), requireRole('ADMIN', 'STAFF'));

adminReviewRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await adminListReviews(adminReviewListQuerySchema.parse(req.query)));
  }),
);

adminReviewRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Review');
    res.json(await adminModerateReview(req.user!.id, id, moderateReviewSchema.parse(req.body)));
  }),
);

adminReviewRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await adminDeleteReview(parseId(req.params.id, 'Review'));
    res.status(204).end();
  }),
);
