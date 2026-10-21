import { prisma } from '@susharts/db';
import { formatInr } from '@susharts/shared';
import { publicWebUrl, sendEmail } from '../../lib/email.js';
import { logger } from '../../lib/logger.js';

export type OrderNotificationType =
  | 'ORDER_CONFIRMED'
  | 'PAYMENT_FAILED'
  | 'ORDER_SHIPPED'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED';

export const MAX_EMAIL_ATTEMPTS = 5;

interface EmailOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  email: string;
  totalInPaise: number;
  shippingInPaise: number;
  subtotalInPaise: number;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  postalCode: string;
  shippingCarrier: string | null;
  trackingNumber: string | null;
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    lineTotalInPaise: number;
  }>;
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemLabel(i: EmailOrder['items'][number]): string {
  return `${i.productName}${i.variantLabel !== 'Default' ? ` (${i.variantLabel})` : ''} × ${i.quantity}`;
}

/** Builds the subject and bodies. Customer-entered and catalog text is HTML-escaped. */
export function buildOrderEmail(type: OrderNotificationType, order: EmailOrder) {
  const link = `${publicWebUrl()}/orders/${order.id}`;
  const first = order.customerName.split(' ')[0] || order.customerName;

  const intro: Record<OrderNotificationType, { subject: string; lines: string[] }> = {
    ORDER_CONFIRMED: {
      subject: `Order confirmed — ${order.orderNumber}`,
      lines: [
        `Thank you for your order! We've received your payment of ${formatInr(order.totalInPaise)}.`,
        'We will let you know as soon as it ships.',
      ],
    },
    PAYMENT_FAILED: {
      subject: `Payment not completed — ${order.orderNumber}`,
      lines: [
        "Your payment didn't go through, so this order wasn't placed and you haven't been charged by us.",
        'Your items are still available — you can try again from your cart.',
      ],
    },
    ORDER_SHIPPED: {
      subject: `Your order is on its way — ${order.orderNumber}`,
      lines: [
        'Good news — your order has shipped!',
        ...(order.shippingCarrier || order.trackingNumber
          ? [
              `${order.shippingCarrier ?? 'Courier'}${order.trackingNumber ? ` · Tracking number: ${order.trackingNumber}` : ''}`,
            ]
          : []),
      ],
    },
    ORDER_DELIVERED: {
      subject: `Delivered — ${order.orderNumber}`,
      lines: ['Your order has been delivered. We hope you love your handmade pieces!'],
    },
    ORDER_CANCELLED: {
      subject: `Order cancelled — ${order.orderNumber}`,
      lines: [
        'Your order has been cancelled.',
        'If you were charged, your refund will be processed to your original payment method. Reply to this email if you have any questions.',
      ],
    },
  };

  const { subject, lines } = intro[type];
  const showItems = type !== 'PAYMENT_FAILED';
  const address = [
    order.addressLine1,
    order.addressLine2,
    `${order.city}, ${order.state} ${order.postalCode}`,
  ].filter((l): l is string => Boolean(l));

  const text = [
    `Hi ${first},`,
    '',
    ...lines,
    '',
    ...(showItems
      ? [
          `Order ${order.orderNumber}`,
          ...order.items.map((i) => `- ${itemLabel(i)}: ${formatInr(i.lineTotalInPaise)}`),
          `Total: ${formatInr(order.totalInPaise)}`,
          '',
          'Delivering to:',
          order.customerName,
          ...address,
          '',
        ]
      : []),
    `View your order: ${link}`,
    '',
    '— Susharts, handmade with love',
  ].join('\n');

  const rows = order.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;color:#5c3743">${esc(itemLabel(i))}</td><td style="padding:6px 0;text-align:right;color:#4a2a35">${esc(formatInr(i.lineTotalInPaise))}</td></tr>`,
    )
    .join('');

  const html = `<!doctype html><html><body style="margin:0;background:#fff8fa;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff8fa;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;padding:28px;border:1px solid #fadde6">
<tr><td style="font-size:22px;font-weight:bold;color:#b44462;padding-bottom:16px">Susharts ♡</td></tr>
<tr><td style="color:#4a2a35;font-size:15px;line-height:1.6">
<p style="margin:0 0 12px">Hi ${esc(first)},</p>
${lines.map((l) => `<p style="margin:0 0 12px">${esc(l)}</p>`).join('')}
</td></tr>
${
  showItems
    ? `<tr><td style="padding-top:8px;font-size:14px">
<p style="margin:0 0 6px;font-weight:bold;color:#4a2a35">Order ${esc(order.orderNumber)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #fadde6">${rows}
<tr><td style="padding:8px 0;border-top:1px solid #fadde6;font-weight:bold;color:#4a2a35">Total</td><td style="padding:8px 0;border-top:1px solid #fadde6;text-align:right;font-weight:bold;color:#b44462">${esc(formatInr(order.totalInPaise))}</td></tr></table>
<p style="margin:16px 0 0;color:#8a616c;font-size:13px;line-height:1.5">Delivering to:<br>${[order.customerName, ...address].map(esc).join('<br>')}</p>
</td></tr>`
    : ''
}
<tr><td style="padding-top:24px"><a href="${esc(link)}" style="display:inline-block;background:#d05a7a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:bold;font-size:14px">View your order</a></td></tr>
<tr><td style="padding-top:24px;color:#a8808a;font-size:12px">Handmade with love in India.</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, html, text };
}

/**
 * Sends one order email at most once. Never throws: email problems are recorded on
 * the notification row and must not affect orders or payments.
 *
 * - The (orderId, type) unique key means repeated callbacks/status updates reuse one row.
 * - An attempt is claimed with a compare-and-swap on `attempts`, so concurrent callers
 *   can't both send the same attempt.
 * - The notification id is the Resend idempotency key, so a retry after an ambiguous
 *   failure (e.g. timeout after Resend accepted it) is not delivered twice.
 */
export async function sendOrderNotification(
  orderId: string,
  type: OrderNotificationType,
): Promise<'sent' | 'skipped' | 'failed'> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { orderBy: { productName: 'asc' } } },
    });
    if (!order) return 'skipped';

    let notification = await prisma.emailNotification.findUnique({
      where: { orderId_type: { orderId, type } },
    });
    if (!notification) {
      try {
        notification = await prisma.emailNotification.create({
          data: { orderId, type, recipient: order.email },
        });
      } catch (err) {
        if ((err as { code?: string }).code !== 'P2002') throw err;
        notification = await prisma.emailNotification.findUnique({
          where: { orderId_type: { orderId, type } },
        });
        if (!notification) return 'skipped';
      }
    }

    if (notification.status === 'SENT' || notification.attempts >= MAX_EMAIL_ATTEMPTS)
      return 'skipped';

    const claimed = await prisma.emailNotification.updateMany({
      where: { id: notification.id, status: { not: 'SENT' }, attempts: notification.attempts },
      data: { attempts: { increment: 1 }, status: 'PENDING' },
    });
    if (claimed.count === 0) return 'skipped';

    try {
      const email = buildOrderEmail(type, order);
      const { id: providerId } = await sendEmail({
        ...email,
        to: notification.recipient,
        idempotencyKey: notification.id,
      });
      await prisma.emailNotification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date(), providerId, lastError: null },
      });
      return 'sent';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ orderId, type, err: message }, 'Order email failed');
      await prisma.emailNotification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', lastError: message.slice(0, 500) },
      });
      return 'failed';
    }
  } catch (err) {
    logger.error({ err, orderId, type }, 'Order notification bookkeeping failed');
    return 'failed';
  }
}

/** Retries this order's unsent emails (used by the admin "Retry emails" action). */
export async function retryOrderNotifications(orderId: string): Promise<number> {
  const pending = await prisma.emailNotification.findMany({
    where: { orderId, status: { not: 'SENT' }, attempts: { lt: MAX_EMAIL_ATTEMPTS } },
    select: { type: true },
  });
  let sent = 0;
  for (const { type } of pending)
    if ((await sendOrderNotification(orderId, type)) === 'sent') sent += 1;
  return sent;
}
