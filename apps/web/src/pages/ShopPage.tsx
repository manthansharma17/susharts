import type { CategoryTreeNode, ProductListResponse } from '@susharts/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { ProductCard } from '../components/ProductCard.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';

const SORT_OPTIONS = [
  { value: 'position:asc', label: 'Featured' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'price:asc', label: 'Price: Low to high' },
  { value: 'price:desc', label: 'Price: High to low' },
  { value: 'createdAt:desc', label: 'Newest first' },
] as const;

export function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');
  const search = searchParams.get('search') ?? '';
  const category = searchParams.get('category') ?? '';
  const sortParam = searchParams.get('sort') ?? 'position';
  const orderParam = searchParams.get('order') ?? 'asc';
  const sortKey = `${sortParam}:${orderParam}`;

  const apiPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '12');
    params.set('sort', sortParam);
    params.set('order', orderParam);
    if (search) params.set('search', search);
    if (category) params.set('category', category);
    return `/api/v1/products?${params.toString()}`;
  }, [page, search, category, sortParam, orderParam]);

  const products = useApi<ProductListResponse>(apiPath);
  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');

  const allSubcategories = useMemo(() => {
    if (!categories.data) return [];
    const subs: Array<{ slug: string; name: string; parentName: string }> = [];
    for (const root of categories.data) {
      subs.push({ slug: root.slug, name: root.name, parentName: '' });
      for (const child of root.children) {
        subs.push({ slug: child.slug, name: child.name, parentName: root.name });
      }
    }
    return subs;
  }, [categories.data]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) {
          next.set(key, value);
        } else {
          next.delete(key);
        }
        if (key !== 'page') next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const handleSort = useCallback(
    (value: string) => {
      const [sort, order] = value.split(':') as [string, string];
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('sort', sort);
        next.set('order', order);
        next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  const handleSearch = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      updateParam('search', (form.get('search') as string).trim());
    },
    [updateParam],
  );

  return (
    <div className="container-page py-8">
      <Breadcrumbs items={[{ label: 'Shop' }]} />

      <h1 className="mt-4 font-display text-2xl font-semibold text-cocoa-800 sm:text-3xl">
        {category
          ? allSubcategories.find((c) => c.slug === category)?.name ?? 'Shop'
          : search
            ? `Results for "${search}"`
            : 'All products'}
      </h1>

      {/* Filters bar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex-1 sm:max-w-xs">
          <label htmlFor="shop-search" className="sr-only">Search products</label>
          <input
            key={search}
            id="shop-search"
            name="search"
            type="search"
            defaultValue={search}
            placeholder="Search products…"
            className="field w-full"
          />
        </form>

        <select
          aria-label="Category"
          value={category}
          onChange={(e) => updateParam('category', e.target.value)}
          className="field"
        >
          <option value="">All categories</option>
          {allSubcategories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.parentName ? `${c.parentName} / ${c.name}` : c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Sort by"
          value={sortKey}
          onChange={(e) => handleSort(e.target.value)}
          className="field"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Product grid */}
      <div className="mt-8">
        {products.loading ? (
          <PageSpinner />
        ) : products.error ? (
          <ErrorMessage message={products.error} onRetry={products.refetch} />
        ) : products.data && products.data.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {products.data.pagination.totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateParam('page', String(page - 1))}
                  className="btn-secondary text-xs"
                >
                  ← Previous
                </button>
                <span className="px-3 text-sm text-cocoa-500">
                  Page {products.data.pagination.page} of {products.data.pagination.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= products.data.pagination.totalPages}
                  onClick={() => updateParam('page', String(page + 1))}
                  className="btn-secondary text-xs"
                >
                  Next →
                </button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            title="No products found"
            description={search ? `No results for "${search}". Try a different search.` : 'Check back soon for new handmade creations.'}
            actionLabel={search || category ? 'Clear filters' : undefined}
            actionTo={search || category ? '/shop' : undefined}
          />
        )}
      </div>
    </div>
  );
}
