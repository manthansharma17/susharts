import {
  formatInr,
  FULFILLMENT_STATUSES,
  ORDER_STATUSES,
  type AdminOrderListItem,
  type Paginated,
} from '@susharts/shared';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ErrorMessage } from '../components/ErrorMessage.js';
import {
  formatDateTime,
  FULFILLMENT_LABELS,
  OrderStatusBadge,
  PaymentBadge,
} from '../components/OrderStatusBadge.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';

const PAYMENT_LABELS: Record<(typeof ORDER_STATUSES)[number], string> = {
  PAID: 'Paid',
  PENDING_PAYMENT: 'Awaiting payment',
  CANCELLED: 'Checkout cancelled',
  EXPIRED: 'Expired',
};

export function AdminOrdersPage() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? 'PAID';
  const fulfillment = params.get('fulfillment') ?? '';
  const review = params.get('review') ?? '';

  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    if (status !== 'ALL') q.set('status', status);
    if (fulfillment) q.set('fulfillment', fulfillment);
    if (review) q.set('review', review);
    return `/api/v1/admin/orders?${q.toString()}`;
  }, [page, search, status, fulfillment, review]);

  const orders = useApi<Paginated<AdminOrderListItem>>(path);

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
    <div className="container-page py-8">
      <h1 className="font-display text-3xl font-semibold text-cocoa-800">Orders</h1>
      <p className="mt-1 text-sm text-cocoa-500">
        Paid orders are shown by default. Fulfil them from the order page.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <form
          className="min-w-[14rem] flex-1 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            update('search', String(new FormData(e.currentTarget).get('search') ?? '').trim());
          }}
        >
          <label htmlFor="order-search" className="sr-only">
            Search orders
          </label>
          <input
            key={search}
            id="order-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Order number, name or email…"
            className="field w-full"
          />
        </form>
        <select
          aria-label="Payment"
          value={status}
          onChange={(e) => update('status', e.target.value)}
          className="field"
        >
          <option value="ALL">All payments</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PAYMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Fulfilment"
          value={fulfillment}
          onChange={(e) => update('fulfillment', e.target.value)}
          className="field"
        >
          <option value="">All fulfilment</option>
          {FULFILLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {FULFILLMENT_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Needs review"
          value={review}
          onChange={(e) => update('review', e.target.value)}
          className="field"
        >
          <option value="">Any review state</option>
          <option value="true">Needs review</option>
          <option value="false">No review needed</option>
        </select>
      </div>

      <div className="mt-6">
        {orders.loading && !orders.data ? (
          <PageSpinner />
        ) : orders.error ? (
          <ErrorMessage message={orders.error} onRetry={orders.refetch} />
        ) : !orders.data || orders.data.items.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-blush-300 bg-white/70 px-6 py-14 text-center text-sm text-cocoa-500">
            No orders match these filters.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-blush-100">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-blush-100 text-xs uppercase tracking-wide text-cocoa-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Customer</th>
                    <th className="px-4 py-3 font-semibold">Payment</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-blush-100">
                  {orders.data.items.map((o) => (
                    <tr key={o.id} className="hover:bg-blush-50/60">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/orders/${o.id}`}
                          className="font-semibold text-cocoa-800 hover:text-blush-700"
                        >
                          {o.orderNumber}
                        </Link>
                        <p className="text-xs text-cocoa-400">{formatDateTime(o.createdAt)}</p>
                        {o.requiresReview && (
                          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                            Needs review
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-cocoa-800">{o.customerName}</p>
                        <p className="text-xs text-cocoa-400">{o.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <PaymentBadge status={o.status} />
                      </td>
                      <td className="px-4 py-3">
                        <OrderStatusBadge status={o.status} fulfillment={o.fulfillmentStatus} />
                        <p className="mt-1 text-xs text-cocoa-400">
                          {o.itemCount} item{o.itemCount === 1 ? '' : 's'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-cocoa-800">
                        {formatInr(o.totalInPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {orders.data.pagination.totalPages > 1 && (
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
                  Page {page} of {orders.data.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= orders.data.pagination.totalPages}
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
