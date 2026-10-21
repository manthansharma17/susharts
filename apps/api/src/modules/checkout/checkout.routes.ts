import { checkoutSchema, verifyPaymentSchema } from '@susharts/shared';
import express, { Router, type Request, type RequestHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { logger } from '../../lib/logger.js';
import { getWebhookSecret, verifyWebhookSignature } from '../../lib/razorpay.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  cancelCheckout,
  createCheckout,
  getOrderSummary,
  handleWebhookEvent,
  verifyCheckoutPayment,
} from './checkout.service.js';

function orderIdParam(req: Request): string {
  const result = z.string().uuid().safeParse(req.params.orderId);
  if (!result.success) throw HttpError.notFound('Order not found');
  return result.data;
}

export const checkoutRouter: Router = Router();

checkoutRouter.use(requireAuth());

checkoutRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    res.status(201).json(await createCheckout(req.user!, checkoutSchema.parse(req.body)));
  }),
);

checkoutRouter.post(
  '/:orderId/verify',
  asyncHandler(async (req, res) => {
    const input = verifyPaymentSchema.parse(req.body);
    res.json(await verifyCheckoutPayment(req.user!.id, orderIdParam(req), input));
  }),
);

checkoutRouter.post(
  '/:orderId/cancel',
  asyncHandler(async (req, res) => {
    res.json(await cancelCheckout(req.user!.id, orderIdParam(req)));
  }),
);

checkoutRouter.get(
  '/orders/:orderId',
  asyncHandler(async (req, res) => {
    res.json(await getOrderSummary(req.user!.id, orderIdParam(req)));
  }),
);

const webhookHandler: RequestHandler = (req, res, next) => {
  void (async () => {
    const secret = getWebhookSecret();
    const signature = req.header('x-razorpay-signature');
    const raw = req.body as unknown;
    if (!signature || !Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature, secret)) {
      throw new HttpError(400, 'INVALID_SIGNATURE', 'Invalid webhook signature');
    }
    let body: unknown;
    try {
      body = JSON.parse(raw.toString('utf8'));
    } catch {
      throw HttpError.badRequest('Invalid JSON');
    }
    await handleWebhookEvent(req.header('x-razorpay-event-id'), body);
    res.json({ ok: true });
  })().catch((err: unknown) => {
    if (!(err instanceof HttpError)) logger.error({ err }, 'Razorpay webhook processing failed');
    next(err);
  });
};

/** Mounted before express.json(): signature verification needs the exact raw bytes. */
export const razorpayWebhook: RequestHandler[] = [
  express.raw({ type: 'application/json', limit: '1mb' }),
  webhookHandler,
];
