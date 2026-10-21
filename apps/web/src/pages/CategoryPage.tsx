import type { CategoryTreeNode, ProductListResponse } from '@susharts/shared';
import { useMemo } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { ProductCard } from '../components/ProductCard.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';

export function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get('page') ?? '1');

  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');

  const categoryInfo = useMemo(() => {
    if (!categories.data || !slug) return null;
    for (const root of categories.data) {
      if (root.slug === slug) return { ...root, parent: null as CategoryTreeNode | null };
      for (const child of root.children) {
        if (child.slug === slug) return { ...child, children: [] as typeof root.children, parent: root };
      }
    }
    return null;
  }, [categories.data, slug]);

  const apiPath = useMemo(() => {
    if (!slug) return null;
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '12');
    params.set('category', slug);
    return `/api/v1/products?${params.toString()}`;
  }, [slug, page]);

  const products = useApi<ProductListResponse>(apiPath);

  if (!slug) return <Navigate to="/shop" replace />;

  if (categories.loading || products.loading) return <PageSpinner />;

  if (categories.error) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={categories.error} onRetry={categories.refetch} />
      </div>
    );
  }

  if (!categoryInfo) {
    return (
      <div className="container-page py-8">
        <EmptyState
          title="Category not found"
          description="This category doesn't exist or has been removed."
          actionLabel="Browse all products"
          actionTo="/shop"
        />
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[
          { label: 'Shop', to: '/shop' },
          ...(categoryInfo.parent
            ? [{ label: categoryInfo.parent.name, to: `/category/${categoryInfo.parent.slug}` }]
            : []),
          { label: categoryInfo.name },
        ]}
      />

      <h1 className="mt-4 font-display text-2xl font-semibold text-cocoa-800 sm:text-3xl">
        {categoryInfo.name}
      </h1>
      {categoryInfo.description && (
        <p className="mt-2 max-w-2xl text-sm text-cocoa-500">{categoryInfo.description}</p>
      )}

      {/* Subcategories */}
      {categoryInfo.children.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {categoryInfo.children.map((child) => (
            <Link
              key={child.id}
              to={`/category/${child.slug}`}
              className="rounded-full border border-blush-200 bg-white px-4 py-1.5 text-sm text-cocoa-700 transition hover:border-blush-300 hover:bg-blush-50"
            >
              {child.name}
            </Link>
          ))}
        </div>
      )}

      {/* Products */}
      <div className="mt-8">
        {products.error ? (
          <ErrorMessage message={products.error} onRetry={products.refetch} />
        ) : products.data && products.data.items.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {products.data.pagination.totalPages > 1 && (
              <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('page', String(page - 1));
                      return next;
                    })
                  }
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
                  onClick={() =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set('page', String(page + 1));
                      return next;
                    })
                  }
                  className="btn-secondary text-xs"
                >
                  Next →
                </button>
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            title="No products yet"
            description={`New ${categoryInfo.name.toLowerCase()} creations are on their way.`}
            actionLabel="Browse all products"
            actionTo="/shop"
          />
        )}
      </div>
    </div>
  );
}
