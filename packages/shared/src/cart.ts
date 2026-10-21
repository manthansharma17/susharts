import { z } from 'zod';
import type { FULFILLMENT_TYPES } from './product.js';

export const MAX_CART_LINE_QUANTITY = 20;
export const MAX_CART_LINES = 50;

const quantity = z.number().int().min(1).max(MAX_CART_LINE_QUANTITY);

export const addCartItemSchema = z.object({
  variantId: z.string().uuid(),
  quantity: quantity.default(1),
});
export type AddCartItemInput = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({ quantity });
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

/** A guest cart as kept in the browser; used for preview and merge-on-sign-in. */
export const guestCartSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        // Lenient on purpose: stale local data is clamped by the server, not rejected.
        quantity: z.number().int().min(1).max(999),
      }),
    )
    .max(MAX_CART_LINES),
});
export type GuestCartInput = z.infer<typeof guestCartSchema>;

/**
 * Why a line can't be bought as-is:
 * - UNAVAILABLE: product no longer active, or variant switched off.
 * - INSUFFICIENT_STOCK: fewer in stock than requested (`availableQuantity` says how many).
 */
export const CART_LINE_ISSUES = ['UNAVAILABLE', 'INSUFFICIENT_STOCK'] as const;
export type CartLineIssue = (typeof CART_LINE_ISSUES)[number];

export interface CartLine {
  variantId: string;
  quantity: number;
  product: {
    id: string;
    slug: string;
    name: string;
    heroImageUrl: string | null;
    fulfillmentType: (typeof FULFILLMENT_TYPES)[number];
    productionDays: number | null;
  };
  variant: {
    label: string;
    sku: string;
    priceInPaise: number;
    compareAtPriceInPaise: number | null;
  };
  /** null = unlimited (made to order or untracked stock). */
  availableQuantity: number | null;
  lineTotalInPaise: number;
  issue: CartLineIssue | null;
}

export interface CartResponse {
  items: CartLine[];
  /** Sum over lines without issues; lines with issues are excluded. */
  subtotalInPaise: number;
  itemCount: number;
  hasIssues: boolean;
  /** Variant IDs from the request that no longer exist at all. */
  removedVariantIds: string[];
}
