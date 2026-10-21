import { prisma } from '@susharts/db';
import type {
  AdminReview,
  AdminReviewListQuery,
  ModerateReviewInput,
  Paginated,
} from '@susharts/shared';
import { HttpError } from '../../lib/http-error.js';
import { refreshAggregates } from '../reviews/review.service.js';

const adminSelect = {
  id: true,
  rating: true,
  title: true,
  body: true,
  status: true,
  hiddenReason: true,
  createdAt: true,
  user: { select: { displayName: true, email: true } },
  product: { select: { id: true, name: true, slug: true } },
  hiddenBy: { select: { email: true } },
} as const;

type AdminRow = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: AdminReview['status'];
  hiddenReason: string | null;
  createdAt: Date;
  user: { displayName: string | null; email: string };
  product: { id: string; name: string; slug: string };
  hiddenBy: { email: string } | null;
};

function toAdminReview(row: AdminRow): AdminReview {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    status: row.status,
    hiddenReason: row.hiddenReason,
    createdAt: row.createdAt.toISOString(),
    authorName: row.user.displayName ?? 'Customer',
    authorEmail: row.user.email,
    product: row.product,
    moderatedBy: row.hiddenBy?.email ?? null,
  };
}

export async function adminListReviews(
  query: AdminReviewListQuery,
): Promise<Paginated<AdminReview>> {
  const search = query.search;
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { body: { contains: search, mode: 'insensitive' as const } },
            { user: { email: { contains: search, mode: 'insensitive' as const } } },
            { product: { name: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: adminSelect,
    }),
    prisma.review.count({ where }),
  ]);
  return {
    items: rows.map(toAdminReview),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

/** Hides an abusive review (reversible) or restores it. Aggregates follow. */
export async function adminModerateReview(
  actorId: string,
  reviewId: string,
  input: ModerateReviewInput,
): Promise<AdminReview> {
  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { productId: true },
  });
  if (!existing) throw HttpError.notFound('Review not found');

  const hiding = input.status === 'HIDDEN';
  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.review.update({
      where: { id: reviewId },
      data: {
        status: input.status,
        hiddenReason: hiding ? (input.reason ?? null) : null,
        hiddenAt: hiding ? new Date() : null,
        hiddenById: hiding ? actorId : null,
      },
      select: adminSelect,
    });
    await refreshAggregates(tx, existing.productId);
    return updated;
  });
  return toAdminReview(row);
}

export async function adminDeleteReview(reviewId: string): Promise<void> {
  const existing = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { productId: true },
  });
  if (!existing) throw HttpError.notFound('Review not found');
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: reviewId } });
    await refreshAggregates(tx, existing.productId);
  });
}
