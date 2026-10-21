import { prisma } from '@susharts/db';
import {
  FULFILLMENT_TRANSITIONS,
  canTransition,
  type AdminOrderDetailExtras,
  type AdminOrderListItem,
  type AdminOrderListQuery,
  type OrderSummary,
  type Paginated,
  type UpdateFulfillmentInput,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';
import { getOrderSummary } from '../checkout/checkout.service.js';
import {
  retryOrderNotifications,
  sendOrderNotification,
  type OrderNotificationType,
} from '../notifications/order-notifications.js';
import { orderListSelect, toOrderListItem } from '../orders/orders.routes.js';

export type AdminOrderDetail = OrderSummary & AdminOrderDetailExtras;

const EMAIL_FOR: Partial<Record<UpdateFulfillmentInput['to'], OrderNotificationType>> = {
  SHIPPED: 'ORDER_SHIPPED',
  DELIVERED: 'ORDER_DELIVERED',
  CANCELLED: 'ORDER_CANCELLED',
};

export async function adminListOrders(
  query: AdminOrderListQuery,
): Promise<Paginated<AdminOrderListItem>> {
  const search = query.search;
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.fulfillment ? { fulfillmentStatus: query.fulfillment } : {}),
    ...(query.review !== undefined ? { requiresReview: query.review } : {}),
    ...(search
      ? {
          OR: [
            { orderNumber: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { customerName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: { ...orderListSelect, customerName: true, email: true, requiresReview: true },
    }),
    prisma.order.count({ where }),
  ]);
  return {
    items: rows.map((row) => ({
      ...toOrderListItem(row),
      customerName: row.customerName,
      email: row.email,
      requiresReview: row.requiresReview,
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function adminGetOrder(orderId: string): Promise<AdminOrderDetail> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { email: true } } } },
      notifications: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!order) throw HttpError.notFound('Order not found');
  const summary = await getOrderSummary(order.userId, orderId);

  return {
    ...summary,
    userEmail: order.user.email,
    requiresReview: order.requiresReview,
    reviewReason: order.reviewReason,
    razorpayOrderId: order.razorpayOrderId,
    payments: order.payments.map((p) => ({
      razorpayPaymentId: p.razorpayPaymentId,
      status: p.status,
      amountInPaise: p.amountInPaise,
      method: p.method,
      errorDescription: p.errorDescription,
      createdAt: p.createdAt.toISOString(),
    })),
    events: order.events.map((e) => ({
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
      actorEmail: e.actor?.email ?? null,
    })),
    notifications: order.notifications.map((n) => ({
      type: n.type,
      status: n.status,
      attempts: n.attempts,
      lastError: n.lastError,
      sentAt: n.sentAt?.toISOString() ?? null,
    })),
    allowedTransitions: order.fulfillmentStatus
      ? [...FULFILLMENT_TRANSITIONS[order.fulfillmentStatus]]
      : [],
  };
}

/**
 * Moves a paid order along its fulfillment path. Payment status is never touched, so
 * staff cannot mark an unpaid order paid. The conditional update on `from` makes two
 * staff acting at once safe: the second gets a 409 instead of a double transition.
 */
export async function adminUpdateFulfillment(
  actorId: string,
  orderId: string,
  input: UpdateFulfillmentInput,
): Promise<AdminOrderDetail> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw HttpError.notFound('Order not found');
    if (order.status !== 'PAID' || !order.fulfillmentStatus) {
      throw new HttpError(409, 'NOT_PAID', 'Only paid orders can be fulfilled');
    }
    if (order.fulfillmentStatus !== input.from) {
      throw new HttpError(
        409,
        'STALE_STATUS',
        'This order was updated by someone else. Refresh and try again.',
      );
    }
    if (!canTransition(input.from, input.to)) {
      throw new HttpError(
        400,
        'INVALID_TRANSITION',
        `Cannot move an order from ${input.from} to ${input.to}`,
      );
    }

    const now = new Date();
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: 'PAID', fulfillmentStatus: input.from },
      data: {
        fulfillmentStatus: input.to,
        ...(input.to === 'SHIPPED'
          ? {
              shippedAt: now,
              shippingCarrier: input.shippingCarrier || null,
              trackingNumber: input.trackingNumber || null,
            }
          : {}),
        ...(input.to === 'DELIVERED' ? { deliveredAt: now } : {}),
        ...(input.to === 'CANCELLED'
          ? {
              fulfillmentCancelledAt: now,
              // Payment was captured; refunds are issued manually in the Razorpay dashboard.
              requiresReview: true,
              reviewReason: 'REFUND_NEEDED: cancelled by staff after payment',
            }
          : {}),
      },
    });
    if (moved.count === 0) {
      throw new HttpError(
        409,
        'STALE_STATUS',
        'This order was updated by someone else. Refresh and try again.',
      );
    }

    if (input.to === 'CANCELLED') {
      const items = await tx.orderItem.findMany({
        where: { orderId, stockReserved: true, variantId: { not: null } },
        select: { variantId: true, quantity: true },
      });
      for (const item of items) {
        await tx.productVariant.updateMany({
          where: { id: item.variantId!, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }
    }

    await tx.orderStatusEvent.create({
      data: { orderId, fromStatus: input.from, toStatus: input.to, actorId, note: input.note },
    });
  });

  const email = EMAIL_FOR[input.to];
  if (email) await sendOrderNotification(orderId, email);
  return adminGetOrder(orderId);
}

export async function adminRetryOrderEmails(orderId: string): Promise<AdminOrderDetail> {
  const exists = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
  if (!exists) throw HttpError.notFound('Order not found');
  await retryOrderNotifications(orderId);
  return adminGetOrder(orderId);
}
