import { z } from 'zod';
import type { OrderStatus } from './checkout.js';

export const FULFILLMENT_STATUSES = [
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/** Allowed staff moves. Payment status is never changed here. */
export const FULFILLMENT_TRANSITIONS: Record<FulfillmentStatus, readonly FulfillmentStatus[]> = {
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: FulfillmentStatus, to: FulfillmentStatus): boolean {
  return FULFILLMENT_TRANSITIONS[from].includes(to);
}

export const ORDER_STATUSES = ['PENDING_PAYMENT', 'PAID', 'CANCELLED', 'EXPIRED'] as const;

const page = z.coerce.number().int().positive().default(1);
const limit = z.coerce.number().int().min(1).max(50).default(10);

export const orderListQuerySchema = z.object({ page, limit });
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;

export const adminOrderListQuerySchema = z.object({
  page,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ORDER_STATUSES).optional(),
  fulfillment: z.enum(FULFILLMENT_STATUSES).optional(),
  search: z.string().trim().max(200).optional(),
  review: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type AdminOrderListQuery = z.infer<typeof adminOrderListQuerySchema>;

export const updateFulfillmentSchema = z
  .object({
    /** The status the client believes the order is in; guards against two staff acting at once. */
    from: z.enum(FULFILLMENT_STATUSES),
    to: z.enum(['PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    note: z
      .string()
      .trim()
      .max(500)
      .transform((v) => (v === '' ? null : v))
      .nullable()
      .default(null),
    shippingCarrier: z.string().trim().max(100).optional(),
    trackingNumber: z.string().trim().max(100).optional(),
  })
  .refine((v) => v.to !== 'CANCELLED' || (v.note !== null && v.note.length > 0), {
    message: 'A reason is required to cancel an order',
    path: ['note'],
  });
export type UpdateFulfillmentInput = z.infer<typeof updateFulfillmentSchema>;

export interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  fulfillmentStatus: FulfillmentStatus | null;
  totalInPaise: number;
  itemCount: number;
  firstItemName: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface OrderTimelineEvent {
  toStatus: FulfillmentStatus;
  createdAt: string;
  note: string | null;
}

export interface AdminOrderListItem extends OrderListItem {
  customerName: string;
  email: string;
  requiresReview: boolean;
}

export interface AdminOrderDetailExtras {
  userEmail: string;
  requiresReview: boolean;
  reviewReason: string | null;
  razorpayOrderId: string | null;
  payments: Array<{
    razorpayPaymentId: string;
    status: 'AUTHORIZED' | 'CAPTURED' | 'FAILED';
    amountInPaise: number;
    method: string | null;
    errorDescription: string | null;
    createdAt: string;
  }>;
  events: Array<
    OrderTimelineEvent & { fromStatus: FulfillmentStatus | null; actorEmail: string | null }
  >;
  notifications: Array<{
    type:
      | 'ORDER_CONFIRMED'
      | 'PAYMENT_FAILED'
      | 'ORDER_SHIPPED'
      | 'ORDER_DELIVERED'
      | 'ORDER_CANCELLED';
    status: 'PENDING' | 'SENT' | 'FAILED';
    attempts: number;
    lastError: string | null;
    sentAt: string | null;
  }>;
  allowedTransitions: FulfillmentStatus[];
}
