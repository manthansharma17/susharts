import { prisma } from '@susharts/db';
import {
  MAX_CART_LINE_QUANTITY,
  MAX_CART_LINES,
  type AddCartItemInput,
  type CartLine,
  type CartResponse,
  type GuestCartInput,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';

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

export interface CartVariant {
  id: string;
  label: string;
  sku: string;
  priceInPaise: number;
  compareAtPriceInPaise: number | null;
  stockQuantity: number | null;
  isAvailable: boolean;
  product: {
    id: string;
    slug: string;
    name: string;
    status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
    fulfillmentType: 'READY_STOCK' | 'MADE_TO_ORDER';
    productionDays: number | null;
    images: Array<{ url: string }>;
  };
}

export function isPurchasable(variant: CartVariant): boolean {
  return variant.isAvailable && variant.product.status === 'ACTIVE';
}

export function toCartLine(variant: CartVariant, quantity: number): CartLine {
  const stock = variant.stockQuantity;
  const issue = !isPurchasable(variant)
    ? 'UNAVAILABLE'
    : stock !== null && quantity > stock
      ? 'INSUFFICIENT_STOCK'
      : null;
  return {
    variantId: variant.id,
    quantity,
    product: {
      id: variant.product.id,
      slug: variant.product.slug,
      name: variant.product.name,
      heroImageUrl: variant.product.images[0]?.url ?? null,
      fulfillmentType: variant.product.fulfillmentType,
      productionDays: variant.product.productionDays,
    },
    variant: {
      label: variant.label,
      sku: variant.sku,
      priceInPaise: variant.priceInPaise,
      compareAtPriceInPaise: variant.compareAtPriceInPaise,
    },
    availableQuantity: stock,
    lineTotalInPaise: variant.priceInPaise * quantity,
    issue,
  };
}

/** Builds the cart from server-side variant data; the order of `requested` is kept. */
export function buildCart(
  requested: Array<{ variantId: string; quantity: number }>,
  variants: CartVariant[],
): CartResponse {
  const byId = new Map(variants.map((v) => [v.id, v]));
  const items: CartLine[] = [];
  const removedVariantIds: string[] = [];
  for (const { variantId, quantity } of requested) {
    const variant = byId.get(variantId);
    if (variant) items.push(toCartLine(variant, quantity));
    else removedVariantIds.push(variantId);
  }
  const ok = items.filter((line) => line.issue === null);
  return {
    items,
    subtotalInPaise: ok.reduce((sum, line) => sum + line.lineTotalInPaise, 0),
    itemCount: items.reduce((sum, line) => sum + line.quantity, 0),
    hasIssues: items.length !== ok.length,
    removedVariantIds,
  };
}

/** Throws the HTTP error a customer should see if `quantity` of this variant can't be in their cart. */
export function assertCanHold(variant: CartVariant, quantity: number): void {
  if (!isPurchasable(variant)) {
    throw new HttpError(409, 'UNAVAILABLE', 'This item is no longer available');
  }
  if (quantity > MAX_CART_LINE_QUANTITY) {
    throw HttpError.badRequest(`You can add at most ${MAX_CART_LINE_QUANTITY} of one item`);
  }
  if (variant.stockQuantity !== null && quantity > variant.stockQuantity) {
    throw new HttpError(
      409,
      'INSUFFICIENT_STOCK',
      variant.stockQuantity === 0
        ? 'This item is out of stock'
        : `Only ${variant.stockQuantity} left in stock`,
      { availableQuantity: variant.stockQuantity },
    );
  }
}

async function findVariant(variantId: string): Promise<CartVariant> {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: variantSelect });
  if (!variant) throw HttpError.notFound('Item not found');
  return variant;
}

async function findVariants(ids: string[]): Promise<CartVariant[]> {
  if (ids.length === 0) return [];
  return prisma.productVariant.findMany({ where: { id: { in: ids } }, select: variantSelect });
}

export async function getCart(userId: string): Promise<CartResponse> {
  const rows = await prisma.cartItem.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    select: { variantId: true, quantity: true },
  });
  return buildCart(rows, await findVariants(rows.map((r) => r.variantId)));
}

export async function addCartItem(userId: string, input: AddCartItemInput): Promise<CartResponse> {
  const variant = await findVariant(input.variantId);
  const existing = await prisma.cartItem.findUnique({
    where: { userId_variantId: { userId, variantId: input.variantId } },
  });
  if (!existing && (await prisma.cartItem.count({ where: { userId } })) >= MAX_CART_LINES) {
    throw HttpError.badRequest(`Your cart can hold at most ${MAX_CART_LINES} different items`);
  }
  const quantity = (existing?.quantity ?? 0) + input.quantity;
  assertCanHold(variant, quantity);

  await prisma.cartItem.upsert({
    where: { userId_variantId: { userId, variantId: input.variantId } },
    create: { userId, variantId: input.variantId, quantity },
    update: { quantity },
  });
  return getCart(userId);
}

export async function setCartItemQuantity(
  userId: string,
  variantId: string,
  quantity: number,
): Promise<CartResponse> {
  const existing = await prisma.cartItem.findUnique({ where: { userId_variantId: { userId, variantId } } });
  if (!existing) throw HttpError.notFound('Item is not in your cart');
  assertCanHold(await findVariant(variantId), quantity);
  await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity } });
  return getCart(userId);
}

export async function removeCartItem(userId: string, variantId: string): Promise<CartResponse> {
  await prisma.cartItem.deleteMany({ where: { userId, variantId } });
  return getCart(userId);
}

export async function clearCart(userId: string): Promise<CartResponse> {
  await prisma.cartItem.deleteMany({ where: { userId } });
  return getCart(userId);
}

/** Combines duplicate variant lines from a client-supplied list. */
function combine(items: GuestCartInput['items']): Array<{ variantId: string; quantity: number }> {
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity);
  return [...totals].map(([variantId, quantity]) => ({ variantId, quantity }));
}

/** Prices a guest cart from the database without storing anything. */
export async function previewGuestCart(input: GuestCartInput): Promise<CartResponse> {
  const items = combine(input.items);
  return buildCart(items, await findVariants(items.map((i) => i.variantId)));
}

/**
 * Folds a guest cart into the user's saved cart. Quantities add up but are
 * clamped to stock and the per-line limit; unavailable items are skipped.
 */
export async function mergeGuestCart(userId: string, input: GuestCartInput): Promise<CartResponse> {
  const guest = combine(input.items);
  const variants = new Map((await findVariants(guest.map((g) => g.variantId))).map((v) => [v.id, v]));
  const saved = new Map(
    (await prisma.cartItem.findMany({ where: { userId }, select: { variantId: true, quantity: true } })).map(
      (row) => [row.variantId, row.quantity],
    ),
  );

  let lines = saved.size;
  for (const { variantId, quantity } of guest) {
    const variant = variants.get(variantId);
    if (!variant || !isPurchasable(variant)) continue;

    const current = saved.get(variantId) ?? 0;
    if (current === 0 && lines >= MAX_CART_LINES) continue;
    const target = Math.min(
      current + quantity,
      MAX_CART_LINE_QUANTITY,
      variant.stockQuantity ?? Number.POSITIVE_INFINITY,
    );
    if (target <= current) continue;

    await prisma.cartItem.upsert({
      where: { userId_variantId: { userId, variantId } },
      create: { userId, variantId, quantity: target },
      update: { quantity: target },
    });
    if (current === 0) lines += 1;
  }
  return getCart(userId);
}
