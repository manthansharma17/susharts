import { prisma } from '@susharts/db';
import {
  shortenName,
  type CreateReviewInput,
  type FeaturedReview,
  type RatingSummary,
  type Review,
  type ReviewListQuery,
  type ReviewListResponse,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface ReviewRow {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: Date;
  userId: string;
  user: { displayName: string | null };
}

function toReview(row: ReviewRow, viewerId: string | null): Review {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    author: shortenName(row.user.displayName),
    createdAt: row.createdAt.toISOString(),
    verifiedPurchase: true,
    isMine: row.userId === viewerId,
  };
}

/**
 * Recomputes the product's published-review aggregates from the rows themselves.
 * Cheaper alternatives drift; this cannot, and it runs only on review writes.
 */
async function refreshAggregates(tx: Tx, productId: string): Promise<void> {
  const agg = await tx.review.aggregate({
    where: { productId, status: 'PUBLISHED' },
    _count: true,
    _sum: { rating: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { reviewCount: agg._count, ratingSum: agg._sum.rating ?? 0 },
  });
}

async function findProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!product) throw HttpError.notFound('Product not found');
  return product;
}

/** True when the customer has a paid order containing this product. */
async function hasPurchased(userId: string, productId: string): Promise<boolean> {
  const count = await prisma.orderItem.count({
    where: { productId, order: { userId, status: 'PAID' } },
  });
  return count > 0;
}

async function ratingSummary(productId: string): Promise<RatingSummary> {
  const grouped = await prisma.review.groupBy({
    by: ['rating'],
    where: { productId, status: 'PUBLISHED' },
    _count: true,
  });
  const breakdown: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let count = 0;
  let sum = 0;
  for (const row of grouped) {
    breakdown[String(row.rating)] = row._count;
    count += row._count;
    sum += row.rating * row._count;
  }
  return { average: count === 0 ? 0 : Math.round((sum / count) * 10) / 10, count, breakdown };
}

export async function listProductReviews(
  slug: string,
  query: ReviewListQuery,
  viewerId: string | null,
): Promise<ReviewListResponse> {
  const product = await findProductBySlug(slug);
  const where = { productId: product.id, status: 'PUBLISHED' as const };
  const orderBy =
    query.sort === 'highest'
      ? [{ rating: 'desc' as const }, { createdAt: 'desc' as const }]
      : query.sort === 'lowest'
        ? [{ rating: 'asc' as const }, { createdAt: 'desc' as const }]
        : [{ createdAt: 'desc' as const }];

  const select = {
    id: true,
    rating: true,
    title: true,
    body: true,
    createdAt: true,
    userId: true,
    user: { select: { displayName: true } },
  } as const;

  const [rows, total, summary] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select,
    }),
    prisma.review.count({ where }),
    ratingSummary(product.id),
  ]);

  // The viewer's own review is returned even when hidden, so they can see it was moderated.
  const mine = viewerId
    ? await prisma.review.findUnique({
        where: { productId_userId: { productId: product.id, userId: viewerId } },
        select: { ...select, status: true, hiddenReason: true },
      })
    : null;

  let reason: ReviewListResponse['viewer']['reason'] = 'SIGN_IN';
  if (viewerId) {
    reason = mine
      ? 'ALREADY_REVIEWED'
      : (await hasPurchased(viewerId, product.id))
        ? 'OK'
        : 'NOT_PURCHASED';
  }

  return {
    items: rows.map((row) => toReview(row, viewerId)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
    summary,
    viewer: {
      canReview: reason === 'OK',
      reason,
      myReview: mine
        ? { ...toReview(mine, viewerId), status: mine.status, hiddenReason: mine.hiddenReason }
        : null,
    },
  };
}

/** Recent, positive, written reviews for the homepage. Published only. */
export async function listFeaturedReviews(limit: number): Promise<FeaturedReview[]> {
  const rows = await prisma.review.findMany({
    where: {
      status: 'PUBLISHED',
      rating: { gte: 4 },
      body: { not: null },
      product: { status: 'ACTIVE' },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: { select: { displayName: true } },
      product: { select: { name: true, slug: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    rating: row.rating,
    body: row.body ?? '',
    author: shortenName(row.user.displayName),
    product: row.product,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function createReview(
  userId: string,
  slug: string,
  input: CreateReviewInput,
): Promise<Review> {
  const product = await findProductBySlug(slug);
  if (!(await hasPurchased(userId, product.id))) {
    throw new HttpError(
      403,
      'NOT_PURCHASED',
      'Only customers who bought this product can review it',
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: { productId: product.id, userId, ...input },
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          createdAt: true,
          userId: true,
          user: { select: { displayName: true } },
        },
      });
      await refreshAggregates(tx, product.id);
      return toReview(created, userId);
    });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      throw new HttpError(409, 'ALREADY_REVIEWED', 'You have already reviewed this product');
    }
    throw err;
  }
}

async function findOwnReview(userId: string, reviewId: string) {
  const review = await prisma.review.findFirst({ where: { id: reviewId, userId } });
  if (!review) throw HttpError.notFound('Review not found');
  return review;
}

export async function updateOwnReview(
  userId: string,
  reviewId: string,
  input: CreateReviewInput,
): Promise<Review> {
  const existing = await findOwnReview(userId, reviewId);
  if (existing.status === 'HIDDEN') {
    throw new HttpError(
      403,
      'REVIEW_HIDDEN',
      'This review was removed by our team and cannot be edited',
    );
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: input,
      select: {
        id: true,
        rating: true,
        title: true,
        body: true,
        createdAt: true,
        userId: true,
        user: { select: { displayName: true } },
      },
    });
    await refreshAggregates(tx, existing.productId);
    return toReview(updated, userId);
  });
}

export async function deleteOwnReview(userId: string, reviewId: string): Promise<void> {
  const existing = await findOwnReview(userId, reviewId);
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: reviewId } });
    await refreshAggregates(tx, existing.productId);
  });
}

export { refreshAggregates };
