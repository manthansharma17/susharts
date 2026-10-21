import { addCartItemSchema, guestCartSchema, updateCartItemSchema } from '@susharts/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { asyncHandler } from '../../middleware/async-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import {
  addCartItem,
  clearCart,
  getCart,
  mergeGuestCart,
  previewGuestCart,
  removeCartItem,
  setCartItemQuantity,
} from './cart.service.js';

const userId = (req: Request) => req.user!.id;

function variantIdParam(req: Request): string {
  const result = z.string().uuid().safeParse(req.params.variantId);
  if (!result.success) throw HttpError.notFound('Item is not in your cart');
  return result.data;
}

export const cartRouter: Router = Router();

// Guests: price a browser-held cart. Read-only; nothing is stored.
cartRouter.post(
  '/preview',
  asyncHandler(async (req, res) => {
    res.json(await previewGuestCart(guestCartSchema.parse(req.body)));
  }),
);

cartRouter.use(requireAuth());

cartRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await getCart(userId(req)));
  }),
);

cartRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await clearCart(userId(req)));
  }),
);

cartRouter.post(
  '/items',
  asyncHandler(async (req, res) => {
    res.json(await addCartItem(userId(req), addCartItemSchema.parse(req.body)));
  }),
);

cartRouter.patch(
  '/items/:variantId',
  asyncHandler(async (req, res) => {
    const { quantity } = updateCartItemSchema.parse(req.body);
    res.json(await setCartItemQuantity(userId(req), variantIdParam(req), quantity));
  }),
);

cartRouter.delete(
  '/items/:variantId',
  asyncHandler(async (req, res) => {
    res.json(await removeCartItem(userId(req), variantIdParam(req)));
  }),
);

cartRouter.post(
  '/merge',
  asyncHandler(async (req, res) => {
    res.json(await mergeGuestCart(userId(req), guestCartSchema.parse(req.body)));
  }),
);
