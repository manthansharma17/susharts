import { MAX_RATING, type ReviewListResponse } from '@susharts/shared';
import { useMemo, useState, type FormEvent } from 'react';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Spinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { apiFetch, ApiRequestError } from '../lib/api-client.js';
import { useAuth } from '../lib/auth-context.js';
import { formatDate } from './OrderStatusBadge.js';
import { StarPicker, Stars } from './Stars.js';

type MyReview = NonNullable<ReviewListResponse['viewer']['myReview']>;

function errorText(err: unknown): string {
  return err instanceof ApiRequestError || err instanceof Error
    ? err.message
    : 'Something went wrong';
}

function Summary({ summary }: { summary: ReviewListResponse['summary'] }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
      <div className="text-center sm:text-left">
        <p className="font-display text-5xl font-semibold text-cocoa-800">
          {summary.average.toFixed(1)}
        </p>
        <Stars value={summary.average} size="md" className="mt-2" />
        <p className="mt-1 text-xs text-cocoa-400">
          {summary.count} review{summary.count === 1 ? '' : 's'}
        </p>
      </div>
      <ul className="flex-1 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const n = summary.breakdown[String(star)] ?? 0;
          const pct = summary.count === 0 ? 0 : (n / summary.count) * 100;
          return (
            <li key={star} className="flex items-center gap-3 text-xs text-cocoa-500">
              <span className="w-10 shrink-0">{star} star</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-blush-100">
                <span
                  className="block h-full rounded-full bg-amber-400"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-6 text-right">{n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewForm({
  slug,
  existing,
  onSaved,
  onCancel,
}: {
  slug: string;
  existing: MyReview | null;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError('Please choose a star rating.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = JSON.stringify({
        rating,
        title: title.trim() || null,
        body: body.trim() || null,
      });
      if (existing)
        await apiFetch(`/api/v1/reviews/${existing.id}`, { method: 'PATCH', body: payload });
      else await apiFetch(`/api/v1/products/${slug}/reviews`, { method: 'POST', body: payload });
      onSaved();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="rounded-2xl bg-blush-100 p-5" noValidate>
      <p className="font-display text-lg font-semibold text-cocoa-800">
        {existing ? 'Edit your review' : 'Write a review'}
      </p>
      <div className="mt-3">
        <StarPicker value={rating} onChange={setRating} disabled={busy} />
      </div>
      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="review-title" className="block text-xs font-medium text-cocoa-600">
            Headline (optional)
          </label>
          <input
            id="review-title"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Beautiful and so well made"
            className="field mt-1 w-full"
          />
        </div>
        <div>
          <label htmlFor="review-body" className="block text-xs font-medium text-cocoa-600">
            Your review (optional)
          </label>
          <textarea
            id="review-body"
            value={body}
            rows={4}
            maxLength={2000}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you like about it?"
            className="field mt-1 w-full rounded-2xl"
          />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Post review'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-cocoa-400">
        Your review shows your first name and last initial. Please keep it kind — abusive reviews
        are removed.
      </p>
    </form>
  );
}

function MyReviewCard({
  review,
  slug,
  onChanged,
}: {
  review: MyReview;
  slug: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm('Delete your review?')) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/reviews/${review.id}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <ReviewForm
        slug={slug}
        existing={review}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="rounded-2xl bg-blush-100 p-5">
      <p className="text-xs font-medium uppercase tracking-eyebrow text-blush-600">Your review</p>
      {review.status === 'HIDDEN' ? (
        <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm text-cocoa-600">
          This review was removed by our team
          {review.hiddenReason ? `: ${review.hiddenReason}` : '.'} It is no longer shown on the site
          and cannot be edited.
        </p>
      ) : (
        <>
          <Stars value={review.rating} className="mt-2" />
          {review.title && <p className="mt-2 font-medium text-cocoa-800">{review.title}</p>}
          {review.body && (
            <p className="mt-1 whitespace-pre-line text-sm text-cocoa-600">{review.body}</p>
          )}
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="btn-secondary px-4 py-1.5 text-xs"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void remove()}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export function ProductReviews({ slug }: { slug: string }) {
  const { user, signInWithGoogle } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const path = useMemo(
    () => `/api/v1/products/${slug}/reviews?page=${page}&limit=5&sort=${sort}`,
    [slug, page, sort],
  );
  const reviews = useApi<ReviewListResponse>(path);

  const data = reviews.data;
  const viewer = data?.viewer;

  return (
    <section aria-labelledby="reviews-heading" className="mt-16 border-t border-blush-200 pt-12">
      <h2 id="reviews-heading" className="font-display text-3xl font-semibold text-cocoa-800">
        Reviews
      </h2>

      {reviews.loading && !data ? (
        <div className="py-10 text-center">
          <Spinner />
        </div>
      ) : reviews.error ? (
        <div className="mt-6">
          <ErrorMessage message={reviews.error} onRetry={reviews.refetch} />
        </div>
      ) : !data ? null : (
        <div className="mt-6 grid gap-10 lg:grid-cols-[20rem_1fr]">
          <div className="space-y-6">
            {data.summary.count > 0 ? (
              <Summary summary={data.summary} />
            ) : (
              <p className="text-sm text-cocoa-500">
                No reviews yet — be the first to share your thoughts.
              </p>
            )}

            {viewer?.myReview ? (
              <MyReviewCard review={viewer.myReview} slug={slug} onChanged={reviews.refetch} />
            ) : viewer?.canReview ? (
              <ReviewForm slug={slug} existing={null} onSaved={reviews.refetch} />
            ) : viewer?.reason === 'SIGN_IN' ? (
              <div className="rounded-2xl bg-blush-100 p-5 text-sm text-cocoa-600">
                <p>Bought this? Sign in to leave a review.</p>
                <button
                  type="button"
                  onClick={() => void signInWithGoogle()}
                  className="btn-primary mt-3"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <p className="rounded-2xl bg-blush-100 p-5 text-sm text-cocoa-600">
                Only customers who have bought this product can review it{user ? '.' : '.'}
              </p>
            )}
          </div>

          <div>
            {data.items.length === 0 ? (
              <p className="text-sm text-cocoa-400">No published reviews yet.</p>
            ) : (
              <>
                <div className="flex justify-end">
                  <label htmlFor="review-sort" className="sr-only">
                    Sort reviews
                  </label>
                  <select
                    id="review-sort"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value as typeof sort);
                      setPage(1);
                    }}
                    className="field py-1.5 text-xs"
                  >
                    <option value="recent">Most recent</option>
                    <option value="highest">Highest rated</option>
                    <option value="lowest">Lowest rated</option>
                  </select>
                </div>

                <ul className="mt-4 divide-y divide-blush-200">
                  {data.items.map((review) => (
                    <li key={review.id} className="py-5">
                      <div className="flex items-start gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blush-100 text-sm font-semibold text-blush-700">
                          {review.author.initial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-medium text-cocoa-800">
                              {review.author.name}
                            </span>
                            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-700">
                              Verified purchase
                            </span>
                            <span className="text-xs text-cocoa-400">
                              {formatDate(review.createdAt)}
                            </span>
                          </div>
                          <Stars value={review.rating} size="sm" className="mt-1.5" />
                          {review.title && (
                            <p className="mt-2 font-medium text-cocoa-800">{review.title}</p>
                          )}
                          {review.body && (
                            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-cocoa-600">
                              {review.body}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {data.pagination.totalPages > 1 && (
                  <nav
                    aria-label="Review pages"
                    className="mt-4 flex items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="btn-secondary text-xs"
                    >
                      ← Previous
                    </button>
                    <span className="px-2 text-xs text-cocoa-500">
                      Page {page} of {data.pagination.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= data.pagination.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="btn-secondary text-xs"
                    >
                      Next →
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <span className="sr-only">Ratings run from 1 to {MAX_RATING} stars.</span>
    </section>
  );
}
