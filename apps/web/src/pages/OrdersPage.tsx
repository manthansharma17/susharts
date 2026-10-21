import { formatInr, type OrderListItem, type Paginated } from '@susharts/shared';
import { Link, useSearchParams } from 'react-router-dom';
import { HeartIcon } from '../components/Decor.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { formatDate, OrderStatusBadge } from '../components/OrderStatusBadge.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { useAuth } from '../lib/auth-context.js';

export function OrdersPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const orders = useApi<Paginated<OrderListItem>>(
    user ? `/api/v1/orders?page=${page}&limit=10` : null,
  );

  if (authLoading || (user && orders.loading && !orders.data)) return <PageSpinner />;

  if (!user) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white px-6 py-12 text-center shadow-soft ring-1 ring-blush-100">
          <h1 className="font-display text-2xl font-semibold text-cocoa-800">
            Sign in to see your orders
          </h1>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="btn-primary mt-6"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (orders.error && !orders.data) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={orders.error} onRetry={orders.refetch} />
      </div>
    );
  }

  const data = orders.data;
  const goTo = (p: number) => setParams(p > 1 ? { page: String(p) } : {});

  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="flex items-center gap-2 font-display text-3xl font-semibold text-cocoa-800 sm:text-4xl">
        My orders <HeartIcon filled className="h-6 w-6 text-blush-400" />
      </h1>

      {!data || data.items.length === 0 ? (
        <div className="mt-8 rounded-[2rem] bg-white px-6 py-14 text-center shadow-soft ring-1 ring-blush-100">
          <p className="font-display text-xl text-cocoa-700">No orders yet</p>
          <p className="mt-1 text-sm text-cocoa-400">
            When you place an order, it will appear here.
          </p>
          <Link to="/shop" className="btn-primary mt-6">
            Start shopping →
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-3">
            {data.items.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-blush-100 transition hover:-translate-y-0.5 hover:shadow-soft sm:p-5"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-cocoa-800">{o.orderNumber}</p>
                    <p className="mt-0.5 truncate text-sm text-cocoa-500">
                      {o.firstItemName ?? 'Order'}
                      {o.itemCount > 1 ? ` + ${o.itemCount - 1} more` : ''}
                    </p>
                    <p className="mt-0.5 text-xs text-cocoa-400">
                      Placed {formatDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <OrderStatusBadge status={o.status} fulfillment={o.fulfillmentStatus} />
                    <span className="font-display text-lg font-semibold text-blush-700">
                      {formatInr(o.totalInPaise)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {data.pagination.totalPages > 1 && (
            <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => goTo(page - 1)}
                className="btn-secondary text-xs"
              >
                ← Newer
              </button>
              <span className="px-3 text-sm text-cocoa-500">
                Page {page} of {data.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.pagination.totalPages}
                onClick={() => goTo(page + 1)}
                className="btn-secondary text-xs"
              >
                Older →
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
