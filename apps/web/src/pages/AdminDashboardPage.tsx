import { formatInr, PRODUCT_STATUSES, type AdminProductListResponse } from '@susharts/shared';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FlowerIcon } from '../components/Decor.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-green-50 text-green-700',
  DRAFT: 'bg-amber-50 text-amber-700',
  ARCHIVED: 'bg-blush-100 text-cocoa-500',
};

export function AdminDashboardPage() {
  const [params, setParams] = useSearchParams();
  const page = Number(params.get('page') ?? '1');
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';

  const path = useMemo(() => {
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) q.set('search', search);
    if (status) q.set('status', status);
    return `/api/v1/admin/products?${q.toString()}`;
  }, [page, search, status]);

  const products = useApi<AdminProductListResponse>(path);

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-800">Products</h1>
          <p className="mt-1 text-sm text-cocoa-500">All products, including drafts and archived items.</p>
        </div>
        <Link to="/admin/products/new" className="btn-primary">
          + New product
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <form
          className="flex-1 sm:max-w-xs"
          onSubmit={(e) => {
            e.preventDefault();
            update('search', String(new FormData(e.currentTarget).get('search') ?? '').trim());
          }}
        >
          <label htmlFor="admin-search" className="sr-only">
            Search products
          </label>
          <input
            key={search}
            id="admin-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search by name or slug…"
            className="field w-full"
          />
        </form>
        <select
          aria-label="Status"
          value={status}
          onChange={(e) => update('status', e.target.value)}
          className="field"
        >
          <option value="">All statuses</option>
          {PRODUCT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6">
        {products.loading ? (
          <PageSpinner />
        ) : products.error ? (
          <ErrorMessage message={products.error} onRetry={products.refetch} />
        ) : !products.data || products.data.items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-blush-300 bg-white/70 px-6 py-14 text-center">
            <FlowerIcon className="mx-auto h-12 w-12 text-blush-300" />
            <p className="mt-4 font-display text-lg text-cocoa-700">
              {search || status ? 'No products match these filters' : 'No products yet'}
            </p>
            {!search && !status && (
              <Link to="/admin/products/new" className="btn-primary mt-5">
                Create your first product
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-3xl bg-white shadow-sm ring-1 ring-blush-100">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-blush-100 text-xs uppercase tracking-wide text-cocoa-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Product</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Price from</th>
                    <th className="px-4 py-3 font-semibold">Images</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-blush-100">
                  {products.data.items.map((p) => (
                    <tr key={p.id} className="hover:bg-blush-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-blush-100">
                            {p.heroImageUrl ? (
                              <img src={p.heroImageUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <FlowerIcon className="m-2.5 h-6 w-6 text-blush-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <Link
                              to={`/admin/products/${p.id}`}
                              className="block truncate font-semibold text-cocoa-800 hover:text-blush-700"
                            >
                              {p.name}
                            </Link>
                            <p className="truncate text-xs text-cocoa-400">/{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[p.status]}`}>
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-cocoa-600">{p.categoryName}</td>
                      <td className="px-4 py-3 text-cocoa-600">
                        {p.minPriceInPaise === null ? (
                          <span className="text-cocoa-300">No variants</span>
                        ) : (
                          formatInr(p.minPriceInPaise)
                        )}
                      </td>
                      <td className="px-4 py-3 text-cocoa-600">{p.imageCount}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link to={`/admin/products/${p.id}`} className="btn-secondary mr-2 px-3 py-1 text-xs">
                          Edit
                        </Link>
                        <Link to={`/admin/products/${p.id}/images`} className="btn-secondary px-3 py-1 text-xs">
                          Photos
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {products.data.pagination.totalPages > 1 && (
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
                  Page {page} of {products.data.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= products.data.pagination.totalPages}
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
