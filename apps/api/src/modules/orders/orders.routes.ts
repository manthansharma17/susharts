import { prisma } from '@susharts/db';
import {
  orderListQuerySchema,
  type OrderListItem,
  type OrderListQuery,
  type Paginated,
} from '@susharts/shared';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { getOrderSummary } from '../checkout/checkout.service.js';

export const orderListSelect = {
  id: true,
  orderNumber: true,
  status: true,
  fulfillmentStatus: true,
  totalInPaise: true,
  createdAt: true,
  paidAt: true,
  items: {
    select: { productName: true, quantity: true },
    orderBy: { productName: 'asc' as const },
  },
} as const;

type OrderListRow = {
  id: string;
  orderNumber: string;
  status: OrderListItem['status'];
  fulfillmentStatus: OrderListItem['fulfillmentStatus'];
  totalInPaise: number;
  createdAt: Date;
  paidAt: Date | null;
  items: Array<{ productName: string; quantity: number }>;
};

export function toOrderListItem(row: OrderListRow): OrderListItem {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    fulfillmentStatus: row.fulfillmentStatus,
    totalInPaise: row.totalInPaise,
    itemCount: row.items.reduce((n, i) => n + i.quantity, 0),
    firstItemName: row.items[0]?.productName ?? null,
    createdAt: row.createdAt.toISOString(),
    paidAt: row.paidAt?.toISOString() ?? null,
  };
}

/** The signed-in customer's orders, newest first. Ownership is enforced by the userId filter. */
export async function listCustomerOrders(
  userId: string,
  query: OrderListQuery,
): Promise<Paginated<OrderListItem>> {
  const where = { userId };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: orderListSelect,
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: rows.map(toOrderListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export const ordersRouter: Router = Router();

ordersRouter.use(requireAuth());

ordersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listCustomerOrders(req.user!.id, orderListQuerySchema.parse(req.query)));
  }),
);

ordersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    // Unknown, malformed, and other customers' orders all look the same: 404.
    if (!id.success) throw HttpError.notFound('Order not found');
    res.json(await getOrderSummary(req.user!.id, id.data));
  }),
);
