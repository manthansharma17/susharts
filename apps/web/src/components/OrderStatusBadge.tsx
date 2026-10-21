import type { FulfillmentStatus, OrderStatus } from '@susharts/shared';

const STYLES = {
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  grey: 'bg-blush-50 text-cocoa-500 ring-blush-200',
  pink: 'bg-blush-100 text-blush-800 ring-blush-200',
  blue: 'bg-sky-50 text-sky-800 ring-sky-200',
  green: 'bg-green-50 text-green-800 ring-green-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
} as const;

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Being prepared',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function orderStatusLabel(
  status: OrderStatus,
  fulfillment: FulfillmentStatus | null,
): { label: string; tone: keyof typeof STYLES } {
  if (status === 'PENDING_PAYMENT') return { label: 'Awaiting payment', tone: 'amber' };
  if (status === 'CANCELLED' || status === 'EXPIRED')
    return { label: 'Payment not completed', tone: 'grey' };
  switch (fulfillment) {
    case 'PROCESSING':
      return { label: FULFILLMENT_LABELS.PROCESSING, tone: 'pink' };
    case 'SHIPPED':
      return { label: FULFILLMENT_LABELS.SHIPPED, tone: 'blue' };
    case 'DELIVERED':
      return { label: FULFILLMENT_LABELS.DELIVERED, tone: 'green' };
    case 'CANCELLED':
      return { label: FULFILLMENT_LABELS.CANCELLED, tone: 'red' };
    default:
      return { label: FULFILLMENT_LABELS.CONFIRMED, tone: 'pink' };
  }
}

export function OrderStatusBadge({
  status,
  fulfillment,
}: {
  status: OrderStatus;
  fulfillment: FulfillmentStatus | null;
}) {
  const { label, tone } = orderStatusLabel(status, fulfillment);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[tone]}`}
    >
      {label}
    </span>
  );
}

export function PaymentBadge({ status }: { status: OrderStatus }) {
  const map: Record<OrderStatus, { label: string; tone: keyof typeof STYLES }> = {
    PAID: { label: 'Paid', tone: 'green' },
    PENDING_PAYMENT: { label: 'Pending', tone: 'amber' },
    CANCELLED: { label: 'Not paid', tone: 'grey' },
    EXPIRED: { label: 'Expired', tone: 'grey' },
  };
  const { label, tone } = map[status];
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STYLES[tone]}`}
    >
      {label}
    </span>
  );
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(iso));
}
