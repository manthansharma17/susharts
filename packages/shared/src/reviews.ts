import { z } from 'zod';

export const MIN_RATING = 1;
export const MAX_RATING = 5;

export const REVIEW_STATUSES = ['PUBLISHED', 'HIDDEN'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .default(null);

export const createReviewSchema = z.object({
  rating: z.number().int().min(MIN_RATING).max(MAX_RATING),
  title: optionalText(120),
  body: optionalText(2000),
});
export type CreateReviewInput = z.infer<typeof createReviewSchema>;

export const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(['recent', 'highest', 'lowest']).default('recent'),
});
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;

export const adminReviewListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(REVIEW_STATUSES).optional(),
  search: z.string().trim().max(200).optional(),
});
export type AdminReviewListQuery = z.infer<typeof adminReviewListQuerySchema>;

export const moderateReviewSchema = z
  .object({
    status: z.enum(REVIEW_STATUSES),
    /** Why it was hidden — required when hiding, for the moderation record. */
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.status !== 'HIDDEN' || Boolean(v.reason), {
    message: 'A reason is required when hiding a review',
    path: ['reason'],
  });
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

export interface ReviewAuthor {
  /** Shortened for privacy, e.g. "Aditi S." */
  name: string;
  initial: string;
}

export interface Review {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author: ReviewAuthor;
  createdAt: string;
  /** Every review comes from a verified purchase. */
  verifiedPurchase: true;
  /** True when this review belongs to the signed-in customer. */
  isMine: boolean;
}

export interface RatingSummary {
  average: number;
  count: number;
  /** Number of reviews per star, keyed "1".."5". */
  breakdown: Record<string, number>;
}

export interface ReviewListResponse {
  items: Review[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: RatingSummary;
  /** What the signed-in customer may do; drives the review form. */
  viewer: {
    canReview: boolean;
    reason: 'OK' | 'SIGN_IN' | 'NOT_PURCHASED' | 'ALREADY_REVIEWED';
    myReview: (Review & { status: ReviewStatus; hiddenReason: string | null }) | null;
  };
}

export interface FeaturedReview {
  id: string;
  rating: number;
  body: string;
  author: ReviewAuthor;
  product: { name: string; slug: string };
  createdAt: string;
}

export interface AdminReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  hiddenReason: string | null;
  createdAt: string;
  authorName: string;
  authorEmail: string;
  product: { id: string; name: string; slug: string };
  moderatedBy: string | null;
}

/** "Aditi Sharma" → "Aditi S." Keeps reviewers' full names off the public page. */
export function shortenName(fullName: string | null | undefined): ReviewAuthor {
  const clean = (fullName ?? '').trim().replace(/\s+/g, ' ');
  if (!clean) return { name: 'Susharts customer', initial: 'S' };
  const [first = '', ...rest] = clean.split(' ');
  const last = rest.at(-1);
  const name = last ? `${first} ${last.charAt(0).toUpperCase()}.` : first;
  return { name, initial: first.charAt(0).toUpperCase() };
}
