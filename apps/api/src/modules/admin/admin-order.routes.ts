import { adminOrderListQuerySchema, updateFulfillmentSchema } from '@susharts/shared';
import { Router } from 'express';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { parseId } from './admin-params.js';
import {
  adminGetOrder,
  adminListOrders,
  adminRetryOrderEmails,
  adminUpdateFulfillment,
} from './admin-order.service.js';

export const adminOrderRouter: Router = Router();

adminOrderRouter.use(requireAuth(), requireRole('ADMIN', 'STAFF'));

adminOrderRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await adminListOrders(adminOrderListQuerySchema.parse(req.query)));
  }),
);

adminOrderRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    res.json(await adminGetOrder(parseId(req.params.id, 'Order')));
  }),
);

adminOrderRouter.patch(
  '/:id/fulfillment',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, 'Order');
    const input = updateFulfillmentSchema.parse(req.body);
    res.json(await adminUpdateFulfillment(req.user!.id, id, input));
  }),
);

adminOrderRouter.post(
  '/:id/notifications/retry',
  asyncHandler(async (req, res) => {
    res.json(await adminRetryOrderEmails(parseId(req.params.id, 'Order')));
  }),
);
