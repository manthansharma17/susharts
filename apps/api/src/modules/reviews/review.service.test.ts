import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = {
  product: { findFirst: vi.fn(), update: vi.fn() },
  orderItem: { count: vi.fn() },
  review: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(db)),
};
vi.mock('@susharts/db', () => ({ prisma: db }));

const { createReview, deleteOwnReview, listProductReviews, updateOwnReview } = await import(
  './review.service.js'
);

const PRODUCT = { id: 'p1' };
const REVIEW_ID = '11111111-1111-4111-8111-111111111111';
const row = (over: Record<string, unknown> = {}) => ({
  id: REVIEW_ID,
  rating: 5,
  title: 'Lovely',
  body: 'Beautiful work',
  createdAt: new Date('2026-10-01T00:00:00Z'),
  userId: 'u1',
  user: { displayName: 'Aditi Sharma' },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.$transaction.mockImplementation((fn: (tx: unknown) => unknown) => fn(db));
  db.product.findFirst.mockResolvedValue(PRODUCT);
  db.orderItem.count.mockResolvedValue(1);
  db.review.findMany.mockResolvedValue([]);
  db.review.count.mockResolvedValue(0);
  db.review.groupBy.mockResolvedValue([]);
  db.review.findUnique.mockResolvedValue(null);
  db.review.aggregate.mockResolvedValue({ _count: 2, _sum: { rating: 9 } });
});

describe('createReview', () => {
  it('refuses customers who have not bought the product', async () => {
    db.orderItem.count.mockResolvedValue(0);
    await expect(
      createReview('u1', 'tulip', { rating: 5, title: null, body: null }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'NOT_PURCHASED',
    });
    expect(db.review.create).not.toHaveBeenCalled();
  });

  it('only counts paid orders belonging to that customer as a purchase', async () => {
    db.review.create.mockResolvedValue(row());
    await createReview('u1', 'tulip', { rating: 5, title: null, body: null });
    expect(db.orderItem.count).toHaveBeenCalledWith({
      where: { productId: 'p1', order: { userId: 'u1', status: 'PAID' } },
    });
  });

  it('404s for a product that is not published', async () => {
    db.product.findFirst.mockResolvedValue(null);
    await expect(
      createReview('u1', 'ghost', { rating: 5, title: null, body: null }),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('saves the review and refreshes the product aggregates in one transaction', async () => {
    db.review.create.mockResolvedValue(row());
    const result = await createReview('u1', 'tulip', {
      rating: 5,
      title: 'Lovely',
      body: 'Beautiful work',
    });

    expect(db.review.aggregate).toHaveBeenCalledWith({
      where: { productId: 'p1', status: 'PUBLISHED' },
      _count: true,
      _sum: { rating: true },
    });
    expect(db.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { reviewCount: 2, ratingSum: 9 },
    });
    expect(result).toMatchObject({ rating: 5, verifiedPurchase: true, isMine: true });
    // Full names are never exposed on the storefront.
    expect(result.author.name).toBe('Aditi S.');
  });

  it('409s on a second review for the same product', async () => {
    db.review.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(
      createReview('u1', 'tulip', { rating: 4, title: null, body: null }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'ALREADY_REVIEWED',
    });
  });
});

describe('updateOwnReview / deleteOwnReview', () => {
  it('404s for someone else’s review', async () => {
    db.review.findFirst.mockResolvedValue(null);
    await expect(
      updateOwnReview('intruder', REVIEW_ID, { rating: 1, title: null, body: null }),
    ).rejects.toMatchObject({
      status: 404,
    });
    expect(db.review.findFirst).toHaveBeenCalledWith({
      where: { id: REVIEW_ID, userId: 'intruder' },
    });
    expect(db.review.update).not.toHaveBeenCalled();
  });

  it('refuses to edit a review that staff hid', async () => {
    db.review.findFirst.mockResolvedValue({ id: REVIEW_ID, productId: 'p1', status: 'HIDDEN' });
    await expect(
      updateOwnReview('u1', REVIEW_ID, { rating: 5, title: null, body: null }),
    ).rejects.toMatchObject({
      status: 403,
      code: 'REVIEW_HIDDEN',
    });
  });

  it('updates and recomputes aggregates', async () => {
    db.review.findFirst.mockResolvedValue({ id: REVIEW_ID, productId: 'p1', status: 'PUBLISHED' });
    db.review.update.mockResolvedValue(row({ rating: 3 }));
    await updateOwnReview('u1', REVIEW_ID, { rating: 3, title: null, body: null });
    expect(db.product.update).toHaveBeenCalled();
  });

  it('deletes and recomputes aggregates', async () => {
    db.review.findFirst.mockResolvedValue({ id: REVIEW_ID, productId: 'p1', status: 'PUBLISHED' });
    await deleteOwnReview('u1', REVIEW_ID);
    expect(db.review.delete).toHaveBeenCalledWith({ where: { id: REVIEW_ID } });
    expect(db.product.update).toHaveBeenCalled();
  });
});

describe('listProductReviews', () => {
  it('shows only published reviews and summarises the ratings', async () => {
    db.review.findMany.mockResolvedValue([row(), row({ id: 'r2', rating: 4, userId: 'u2' })]);
    db.review.count.mockResolvedValue(2);
    db.review.groupBy.mockResolvedValue([
      { rating: 5, _count: 1 },
      { rating: 4, _count: 1 },
    ]);

    const result = await listProductReviews('tulip', { page: 1, limit: 10, sort: 'recent' }, 'u1');

    expect(db.review.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { productId: 'p1', status: 'PUBLISHED' } }),
    );
    expect(result.summary).toMatchObject({ average: 4.5, count: 2 });
    expect(result.summary.breakdown).toMatchObject({ '5': 1, '4': 1, '3': 0 });
    expect(result.items[0]?.isMine).toBe(true);
    expect(result.items[1]?.isMine).toBe(false);
  });

  it('tells a signed-out visitor to sign in', async () => {
    const result = await listProductReviews('tulip', { page: 1, limit: 10, sort: 'recent' }, null);
    expect(result.viewer).toMatchObject({ canReview: false, reason: 'SIGN_IN', myReview: null });
    expect(db.orderItem.count).not.toHaveBeenCalled();
  });

  it('tells a signed-in non-buyer why they cannot review', async () => {
    db.orderItem.count.mockResolvedValue(0);
    const result = await listProductReviews('tulip', { page: 1, limit: 10, sort: 'recent' }, 'u1');
    expect(result.viewer).toMatchObject({ canReview: false, reason: 'NOT_PURCHASED' });
  });

  it('returns the viewer’s own hidden review with the moderation reason', async () => {
    db.review.findUnique.mockResolvedValue(
      row({ status: 'HIDDEN', hiddenReason: 'Abusive language' }),
    );
    const result = await listProductReviews('tulip', { page: 1, limit: 10, sort: 'recent' }, 'u1');
    expect(result.viewer).toMatchObject({ canReview: false, reason: 'ALREADY_REVIEWED' });
    expect(result.viewer.myReview).toMatchObject({
      status: 'HIDDEN',
      hiddenReason: 'Abusive language',
    });
  });

  it('sorts by rating when asked', async () => {
    await listProductReviews('tulip', { page: 1, limit: 10, sort: 'highest' }, null);
    expect(db.review.findMany.mock.calls[0]![0].orderBy[0]).toEqual({ rating: 'desc' });
  });
});
