import { randomBytes } from 'node:crypto';
import { prisma } from '@susharts/db';
import {
  ORDER_RESERVATION_MINUTES,
  SHIPPING_FEE_IN_PAISE,
  type CheckoutInput,
  type CheckoutSession,
  type OrderSummary,
  type VerifyPaymentInput,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import {
  captureRazorpayPayment,
  createRazorpayOrder,
  fetchRazorpayPayment,
  getRazorpayConfig,
  verifyPaymentSignature,
  type RazorpayPayment,
} from '../../lib/razorpay.js';
import { toCartLine, type CartVariant } from '../cart/cart.service.js';
import { sendOrderNotification } from '../notifications/order-notifications.js';

/** Razorpay's minimum order amount is ₹1. */
const MIN_AMOUNT_IN_PAISE = 100;

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

class StockConflict extends Error {}

const variantSelect = {
  id: true,
  label: true,
  sku: true,
  priceInPaise: true,
  compareAtPriceInPaise: true,
  stockQuantity: true,
  isAvailable: true,
  product: {
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      fulfillmentType: true,
      productionDays: true,
      images: { select: { url: true }, orderBy: { position: 'asc' as const }, take: 1 },
    },
  },
} as const;

export function generateOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `SUS-${date}-${randomBytes(4).toString('hex').toUpperCase()}`;
}

/** Atomically takes `quantity` from tracked stock; false if not enough is left. */
async function takeStock(tx: Tx, variantId: string, quantity: number): Promise<boolean> {
  const result = await tx.productVariant.updateMany({
    where: { id: variantId, stockQuantity: { gte: quantity } },
    data: { stockQuantity: { decrement: quantity } },
  });
  return result.count === 1;
}

/**
 * Moves a PENDING_PAYMENT order to CANCELLED/EXPIRED and returns its reserved stock.
 * The conditional status update makes this safe to call twice or concurrently.
 */
export async function releaseOrder(
  orderId: string,
  status: 'CANCELLED' | 'EXPIRED',
): Promise<boolean> {
  const released = await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status, cancelledAt: new Date() },
    });
    if (moved.count === 0) return false;
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
    return true;
  });
  // Only tell the customer if a payment attempt actually failed; a plain abandoned checkout gets no email.
  if (released && (await prisma.payment.count({ where: { orderId, status: 'FAILED' } })) > 0) {
    void sendOrderNotification(orderId, 'PAYMENT_FAILED').catch(() => undefined);
  }
  return released;
}

export async function expireStaleOrders(now = new Date()): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: 'PENDING_PAYMENT', expiresAt: { lt: now } },
    select: { id: true },
    take: 100,
  });
  let released = 0;
  for (const { id } of stale) if (await releaseOrder(id, 'EXPIRED')) released += 1;
  return released;
}

export async function createCheckout(
  user: { id: string },
  input: CheckoutInput,
): Promise<CheckoutSession> {
  const razorpay = getRazorpayConfig();

  await expireStaleOrders();
  // One open checkout per customer: starting again releases the previous reservation.
  const open = await prisma.order.findMany({
    where: { userId: user.id, status: 'PENDING_PAYMENT' },
    select: { id: true },
  });
  for (const { id } of open) await releaseOrder(id, 'CANCELLED');

  const cartRows = await prisma.cartItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    select: { variantId: true, quantity: true },
  });
  if (cartRows.length === 0) throw HttpError.badRequest('Your cart is empty');

  const order = await prisma.$transaction(async (tx) => {
    // Prices, availability, and stock are all read inside the transaction; the client sends none of them.
    const variants: CartVariant[] = await tx.productVariant.findMany({
      where: { id: { in: cartRows.map((r) => r.variantId) } },
      select: variantSelect,
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    const lines = cartRows.map((row) => {
      const variant = byId.get(row.variantId);
      const line = variant ? toCartLine(variant, row.quantity) : null;
      if (!variant || !line || line.issue) {
        throw new HttpError(
          409,
          'CART_CHANGED',
          'Some items in your cart have changed. Please review your cart.',
        );
      }
      return { variant, line };
    });

    for (const { variant, line } of lines) {
      if (variant.stockQuantity !== null && !(await takeStock(tx, variant.id, line.quantity))) {
        throw new HttpError(
          409,
          'INSUFFICIENT_STOCK',
          `"${variant.product.name}" no longer has enough stock`,
        );
      }
    }

    const subtotal = lines.reduce((sum, { line }) => sum + line.lineTotalInPaise, 0);
    const total = subtotal + SHIPPING_FEE_IN_PAISE;
    if (total < MIN_AMOUNT_IN_PAISE) throw HttpError.badRequest('Order total must be at least ₹1');

    return tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId: user.id,
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        subtotalInPaise: subtotal,
        shippingInPaise: SHIPPING_FEE_IN_PAISE,
        totalInPaise: total,
        expiresAt: new Date(Date.now() + ORDER_RESERVATION_MINUTES * 60_000),
        items: {
          create: lines.map(({ variant, line }) => ({
            productId: variant.product.id,
            variantId: variant.id,
            productName: variant.product.name,
            productSlug: variant.product.slug,
            variantLabel: variant.label,
            sku: variant.sku,
            unitPriceInPaise: variant.priceInPaise,
            quantity: line.quantity,
            lineTotalInPaise: line.lineTotalInPaise,
            fulfillmentType: variant.product.fulfillmentType,
            productionDays: variant.product.productionDays,
            stockReserved: variant.stockQuantity !== null,
          })),
        },
      },
    });
  });

  let razorpayOrderId: string;
  try {
    const rzpOrder = await createRazorpayOrder({
      amountInPaise: order.totalInPaise,
      receipt: order.orderNumber,
      notes: { orderId: order.id, orderNumber: order.orderNumber },
    });
    razorpayOrderId = rzpOrder.id;
  } catch (err) {
    logger.error({ err, orderId: order.id }, 'Razorpay order creation failed');
    await releaseOrder(order.id, 'CANCELLED');
    throw new HttpError(
      502,
      'PAYMENT_PROVIDER_ERROR',
      'Could not start payment. Please try again.',
    );
  }

  await prisma.order.update({ where: { id: order.id }, data: { razorpayOrderId } });

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    razorpayOrderId,
    razorpayKeyId: razorpay.keyId,
    amountInPaise: order.totalInPaise,
    currency: 'INR',
    customer: { name: input.customerName, email: input.email, phone: input.phone },
  };
}

async function upsertPayment(
  tx: Tx,
  orderId: string,
  payment: RazorpayPayment,
  status: 'AUTHORIZED' | 'CAPTURED' | 'FAILED',
) {
  const existing = await tx.payment.findUnique({ where: { razorpayPaymentId: payment.id } });
  // Never downgrade a captured payment because an older event arrives late.
  if (existing?.status === 'CAPTURED' && status !== 'CAPTURED') return;
  const data = {
    status,
    amountInPaise: payment.amount,
    method: payment.method ?? null,
    errorCode: payment.error_code ?? null,
    errorDescription: payment.error_description ?? null,
  };
  if (existing) await tx.payment.update({ where: { id: existing.id }, data });
  else await tx.payment.create({ data: { ...data, orderId, razorpayPaymentId: payment.id } });
}

async function clearPurchasedFromCart(tx: Tx, orderId: string, userId: string) {
  const items = await tx.orderItem.findMany({ where: { orderId }, select: { variantId: true } });
  const variantIds = items.map((i) => i.variantId).filter((id): id is string => id !== null);
  await tx.cartItem.deleteMany({ where: { userId, variantId: { in: variantIds } } });
}

async function flagForReview(orderId: string, reason: string) {
  logger.warn({ orderId, reason }, 'Order flagged for review');
  await prisma.order.update({
    where: { id: orderId },
    data: { requiresReview: true, reviewReason: reason },
  });
}

async function recordConfirmed(tx: Tx, orderId: string) {
  await tx.orderStatusEvent.create({
    data: {
      orderId,
      fromStatus: null,
      toStatus: 'CONFIRMED',
      actorId: null,
      note: 'Payment verified',
    },
  });
}

/** Marks the order paid for a captured payment. Idempotent; safe under concurrent callback + webhook. */
async function markOrderPaid(orderId: string, payment: RazorpayPayment): Promise<void> {
  const outcome = await prisma.$transaction(async (tx) => {
    await upsertPayment(tx, orderId, payment, 'CAPTURED');
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: 'PENDING_PAYMENT' },
      data: { status: 'PAID', paidAt: new Date(), fulfillmentStatus: 'CONFIRMED' },
    });
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (moved.count === 1) {
      await recordConfirmed(tx, orderId);
      await clearPurchasedFromCart(tx, orderId, order.userId);
    }
    return { moved: moved.count === 1, order };
  });
  if (outcome.moved) return;

  const { order } = outcome;
  if (order.status === 'PAID') {
    const captured = await prisma.payment.count({ where: { orderId, status: 'CAPTURED' } });
    if (captured > 1)
      await flagForReview(orderId, 'DUPLICATE_PAYMENT: more than one captured payment');
    return;
  }

  // Paid after the reservation was released (cancelled/expired). Try to take the stock back.
  try {
    await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['CANCELLED', 'EXPIRED'] } },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          cancelledAt: null,
          fulfillmentStatus: 'CONFIRMED',
        },
      });
      if (moved.count === 0) return;
      await recordConfirmed(tx, orderId);
      const items = await tx.orderItem.findMany({
        where: { orderId, stockReserved: true, variantId: { not: null } },
        select: { variantId: true, quantity: true },
      });
      for (const item of items) {
        if (!(await takeStock(tx, item.variantId!, item.quantity))) throw new StockConflict();
      }
      await clearPurchasedFromCart(tx, orderId, order.userId);
    });
  } catch (err) {
    if (!(err instanceof StockConflict)) throw err;
    // Money was taken but the stock is gone: record it as paid and get a human to resolve it.
    await prisma.$transaction(async (tx) => {
      const moved = await tx.order.updateMany({
        where: { id: orderId, status: { in: ['CANCELLED', 'EXPIRED'] } },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          cancelledAt: null,
          fulfillmentStatus: 'CONFIRMED',
          requiresReview: true,
          reviewReason: 'PAID_AFTER_RELEASE: stock no longer available; refund or restock needed',
        },
      });
      if (moved.count === 1) await recordConfirmed(tx, orderId);
    });
    logger.warn({ orderId }, 'Late payment could not re-reserve stock');
  }
}

/**
 * Applies an authoritative Razorpay payment state (fetched from the API or from a
 * signature-verified webhook) to our order. Returns the affected order id, if any.
 */
export async function applyPayment(payment: RazorpayPayment): Promise<string | null> {
  const order = await prisma.order.findUnique({ where: { razorpayOrderId: payment.order_id } });
  if (!order) {
    logger.warn(
      { paymentId: payment.id, razorpayOrderId: payment.order_id },
      'Payment for unknown order',
    );
    return null;
  }

  if (payment.status === 'failed') {
    await prisma.$transaction((tx) => upsertPayment(tx, order.id, payment, 'FAILED'));
    return order.id;
  }

  if (payment.amount !== order.totalInPaise || payment.currency !== order.currency) {
    await prisma.$transaction((tx) =>
      upsertPayment(
        tx,
        order.id,
        payment,
        payment.status === 'captured' ? 'CAPTURED' : 'AUTHORIZED',
      ),
    );
    await flagForReview(order.id, `AMOUNT_MISMATCH: paid ${payment.amount} ${payment.currency}`);
    return order.id;
  }

  let current = payment;
  if (current.status === 'authorized') {
    try {
      current = await captureRazorpayPayment(current.id, order.totalInPaise);
    } catch (err) {
      // Another request (webhook or callback) may have captured it first.
      current = await fetchRazorpayPayment(current.id);
      if (current.status !== 'captured') {
        logger.error({ err, paymentId: current.id }, 'Payment capture failed');
        await prisma.$transaction((tx) => upsertPayment(tx, order.id, current, 'AUTHORIZED'));
        return order.id;
      }
    }
  }

  if (current.status !== 'captured') return order.id;

  try {
    await markOrderPaid(order.id, current);
  } catch (err) {
    // Two writers raced to insert the same payment row; the second attempt sees it and is a no-op.
    if ((err as { code?: string }).code !== 'P2002') throw err;
    await markOrderPaid(order.id, current);
  }
  // Idempotent: repeated callbacks/webhooks reuse the same notification row and never resend.
  void sendOrderNotification(order.id, 'ORDER_CONFIRMED').catch(() => undefined);
  return order.id;
}

async function findOwnOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw HttpError.notFound('Order not found');
  return order;
}

export async function verifyCheckoutPayment(
  userId: string,
  orderId: string,
  input: VerifyPaymentInput,
): Promise<OrderSummary> {
  const { keySecret } = getRazorpayConfig();
  const order = await findOwnOrder(userId, orderId);

  if (!order.razorpayOrderId || input.razorpay_order_id !== order.razorpayOrderId) {
    throw HttpError.badRequest('Payment does not belong to this order');
  }
  if (
    !verifyPaymentSignature(
      order.razorpayOrderId,
      input.razorpay_payment_id,
      input.razorpay_signature,
      keySecret,
    )
  ) {
    throw new HttpError(400, 'INVALID_SIGNATURE', 'Payment verification failed');
  }

  // The signature proves the ids came from Razorpay; the payment state comes from Razorpay's API, not the browser.
  const payment = await fetchRazorpayPayment(input.razorpay_payment_id);
  if (payment.order_id !== order.razorpayOrderId) {
    throw HttpError.badRequest('Payment does not belong to this order');
  }
  await applyPayment(payment);
  return getOrderSummary(userId, orderId);
}

export async function cancelCheckout(userId: string, orderId: string): Promise<OrderSummary> {
  await findOwnOrder(userId, orderId);
  await releaseOrder(orderId, 'CANCELLED');
  return getOrderSummary(userId, orderId);
}

export async function getOrderSummary(userId: string, orderId: string): Promise<OrderSummary> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: { orderBy: { productName: 'asc' } },
      events: {
        orderBy: { createdAt: 'asc' },
        select: { toStatus: true, createdAt: true, note: true },
      },
      payments: { where: { status: 'FAILED' }, select: { id: true }, take: 1 },
    },
  });
  if (!order) throw HttpError.notFound('Order not found');
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotalInPaise: order.subtotalInPaise,
    shippingInPaise: order.shippingInPaise,
    totalInPaise: order.totalInPaise,
    currency: order.currency,
    customerName: order.customerName,
    email: order.email,
    phone: order.phone,
    address: {
      line1: order.addressLine1,
      line2: order.addressLine2,
      city: order.city,
      state: order.state,
      postalCode: order.postalCode,
    },
    items: order.items.map((i) => ({
      productName: i.productName,
      productSlug: i.productSlug,
      variantLabel: i.variantLabel,
      unitPriceInPaise: i.unitPriceInPaise,
      quantity: i.quantity,
      lineTotalInPaise: i.lineTotalInPaise,
      fulfillmentType: i.fulfillmentType,
      productionDays: i.productionDays,
    })),
    paidAt: order.paidAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    fulfillmentStatus: order.fulfillmentStatus,
    shippingCarrier: order.shippingCarrier,
    trackingNumber: order.trackingNumber,
    shippedAt: order.shippedAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    hadFailedPayment: order.payments.length > 0,
    // Customer-facing timeline: staff notes are internal, so only the status and time are shown.
    timeline: order.events.map((e) => ({
      toStatus: e.toStatus,
      createdAt: e.createdAt.toISOString(),
      note: null,
    })),
  };
}

/** Handles a signature-verified webhook body. Duplicate deliveries are acknowledged without reprocessing. */
export async function handleWebhookEvent(
  eventId: string | undefined,
  body: unknown,
): Promise<void> {
  const event = body as { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } };
  const name = event.event ?? 'unknown';

  if (eventId && (await prisma.webhookEvent.findUnique({ where: { id: eventId } }))) return;

  const payment = event.payload?.payment?.entity;
  const handled = ['payment.authorized', 'payment.captured', 'payment.failed', 'order.paid'];
  if (handled.includes(name) && payment?.id && payment.order_id) {
    await applyPayment(payment);
  }

  // Recorded only after successful processing, so a failure lets Razorpay's retry run it again.
  if (eventId) {
    await prisma.webhookEvent
      .create({ data: { id: eventId, event: name } })
      .catch((err: { code?: string }) => {
        if (err.code !== 'P2002') throw err;
      });
  }
}
