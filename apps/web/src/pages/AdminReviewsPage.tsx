import { REVIEW_STATUSES, type AdminReview, type Paginated } from '@susharts/shared';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { formatDateTime } from '../components/OrderStatusBadge.js';
import { PageSpinner } from '../components/Spinner.js';
import { Stars } from '../components/Stars.js';
import { useApi } from '../hooks/use-api.js';
import { errorText } from '../lib/admin-utils.js';
import { apiFetch } from '../lib/api-client.js';

function ReviewRow({ review, onChanged }: { review: AdminReview; onChanged: () => void }) {
  const [hiding, setHiding] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setHiding(false);
      setReason('');
      onChanged();
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const hide = () => {
    if (!reason.trim()) {
      setError('Please give a reason.');
      return;
    }
    void run(() =>
      apiFetch(`/api/v1/admin/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'HIDDEN', reason: reason.trim() }),
      }),
    );
  };

  const restore = () =>
    void run(() =>
      apiFetch(`/api/v1/admin/reviews/${review.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'PUBLISHED' }),
      }),
    );

  const remove = () => {
    if (!window.confirm('Permanently delete this review? This cannot be undone.')) return;
    void run(() => apiFetch(`/api/v1/admin/reviews/${review.id}`, { method: 'DELETE' }));
  };

  const hidden = review.status === 'HIDDEN';

  return (
    <li
      className={`rounded-2xl p-5 ring-1 ${hidden ? 'bg-blush-50 ring-blush-200' : 'bg-white ring-blush-100'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Stars value={review.rating} size="sm" />
            {hidden && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                Hidden
              </span>
            )}
            <Link
              to={`/products/${review.product.slug}`}
              className="text-xs text-cocoa-500 hover:text-blush-700"
            >
              {review.product.name}
            </Link>
          </div>
          {review.title && <p className="mt-2 font-medium text-cocoa-800">{review.title}</p>}
          {review.body && (
            <p className="mt-1 whitespace-pre-line text-sm text-cocoa-600">{review.body}</p>
          )}
          <p className="mt-2 text-xs text-cocoa-400">
            {review.authorName} · {review.authorEmail} · {formatDateTime(review.createdAt)}
          </p>
          {hidden && review.hiddenReason && (
            <p className="mt-1 text-xs text-red-700">
              Reason: {review.hiddenReason}
              {review.moderatedBy ? ` · by ${review.moderatedBy}` : ''}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {hidden ? (
            <button
              type="button"
              disabled={busy}
              onClick={restore}
              className="btn-secondary px-3 py-1 text-xs"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => setHiding((h) => !h)}
              className="btn-secondary px-3 py-1 text-xs"
            >
              {hiding ? 'Cancel' : 'Hide'}
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={remove}
            className="rounded-full px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {hiding && (
        <div className="mt-4 flex flex-wrap gap-2 rounded-xl bg-blush-100 p-3">
          <label htmlFor={`reason-${review.id}`} className="sr-only">
            Reason for hiding
          </label>
          <input
            id={`reason-${review.id}`}
            value={reason}
            maxLength={300}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Abusive language"
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            disabled={busy}
            onClick={hide}
            className="btn-primary px-4 py-1.5 text-xs"
          >
            Hide review
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </li>
  );
}

export function AdminReviewsPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const status = params.get('status') ?? '';
  const search = params.get('search') ?? '';

  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return `/api/v1/admin/reviews?${q.toString()}`;
  }, [page, status, search]);

  const reviews = useApi<Paginated<AdminReview>>(path);

  function update(key: string, value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }

  return (
    <div className="container-page max-w-4xl py-8">
      <h1 className="font-display text-3xl font-semibold text-cocoa-800">Reviews</h1>
      <p className="mt-1 text-sm text-cocoa-500">
        Hide anything abusive or off-topic — hidden reviews disappear from the site and stop
        counting towards the product rating. Hiding is reversible; deleting is not.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <form
          className="min-w-[14rem] flex-1 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            update('search', String(new FormData(e.currentTarget).get('search') ?? '').trim());
          }}
        >
          <label htmlFor="review-search" className="sr-only">
            Search reviews
          </label>
          <input
            key={search}
            id="review-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search text, product or email…"
            className="field w-full"
          />
        </form>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => update('status', e.target.value)}
          className="field"
        >
          <option value="">All reviews</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s === 'PUBLISHED' ? 'Published' : 'Hidden'}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {reviews.loading && !reviews.data ? (
          <PageSpinner />
        ) : reviews.error ? (
          <ErrorMessage message={reviews.error} onRetry={reviews.refetch} />
        ) : !reviews.data || reviews.data.items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-blush-300 px-6 py-14 text-center text-sm text-cocoa-500">
            No reviews{status || search ? ' match these filters' : ' yet'}.
          </p>
        ) : (
          <>
            <ul className="space-y-4">
              {reviews.data.items.map((review) => (
                <ReviewRow key={review.id} review={review} onChanged={reviews.refetch} />
              ))}
            </ul>
            {reviews.data.pagination.totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => update('page', String(page - 1))}
                  className="btn-secondary text-xs"
                >
                  ← Previous
                </button>
                <span className="px-3 text-sm text-cocoa-500">
                  Page {page} of {reviews.data.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= reviews.data.pagination.totalPages}
                  onClick={() => update('page', String(page + 1))}
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
  );
}
