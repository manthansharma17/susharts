import type { ProductDetail, ProductVariant } from '@susharts/shared';
import { formatInr, MAX_CART_LINE_QUANTITY } from '@susharts/shared';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Price } from '../components/Price.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { useCart } from '../lib/cart-context.js';

function ImageGallery({ images, productName }: { images: ProductDetail['images']; productName: string }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const sorted = [...images].sort((a, b) => a.position - b.position);
  const current = sorted[selectedIndex];

  if (sorted.length === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl bg-blush-100">
        <svg className="h-16 w-16 text-blush-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-blush-100">
        {current && (
          <img
            src={current.url}
            alt={current.altText ?? productName}
            className="aspect-square w-full object-cover"
          />
        )}
      </div>
      {sorted.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {sorted.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setSelectedIndex(i)}
              className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 transition ${
                i === selectedIndex ? 'border-blush-500' : 'border-blush-200 hover:border-blush-400'
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddToCart({ variant }: { variant: ProductVariant }) {
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const max = Math.min(MAX_CART_LINE_QUANTITY, variant.stockQuantity ?? MAX_CART_LINE_QUANTITY);
  const soldOut = !variant.isAvailable || max < 1;

  async function add() {
    setBusy(true);
    setResult(null);
    try {
      await addItem(variant.id, quantity);
      setResult({ ok: true, text: 'Added to your cart' });
    } catch (err) {
      setResult({ ok: false, text: err instanceof Error ? err.message : 'Could not add to cart' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        {!soldOut && (
          <>
            <label htmlFor="add-qty" className="sr-only">
              Quantity
            </label>
            <select
              id="add-qty"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="field py-2.5 pr-8"
            >
              {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Qty {n}
                </option>
              ))}
            </select>
          </>
        )}
        <button
          type="button"
          disabled={soldOut || busy}
          onClick={() => void add()}
          className="btn-primary flex-1 px-8 py-3 text-base sm:flex-none"
        >
          {soldOut ? 'Sold out' : busy ? 'Adding…' : 'Add to cart'}
        </button>
      </div>
      {result && (
        <p role="status" className={`mt-3 text-sm ${result.ok ? 'text-green-700' : 'text-red-700'}`}>
          {result.text}
          {result.ok && (
            <>
              {' · '}
              <Link to="/cart" className="font-semibold text-blush-700 hover:underline">
                View cart
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

function VariantSelector({
  variants,
  selected,
  onSelect,
}: {
  variants: ProductVariant[];
  selected: ProductVariant;
  onSelect: (v: ProductVariant) => void;
}) {
  if (variants.length <= 1) return null;

  const sorted = [...variants].sort((a, b) => a.position - b.position);

  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-medium text-cocoa-800">Options</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {sorted.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelect(v)}
            disabled={!v.isAvailable}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              v.id === selected.id
                ? 'border-blush-500 bg-blush-50 text-cocoa-700'
                : v.isAvailable
                  ? 'border-blush-200 bg-white text-cocoa-800 hover:border-blush-300'
                  : 'border-blush-100 bg-blush-100 text-cocoa-400 line-through'
            }`}
            aria-pressed={v.id === selected.id}
          >
            {v.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function StockBadge({ variant, fulfillmentType, productionDays }: {
  variant: ProductVariant;
  fulfillmentType: string;
  productionDays: number | null;
}) {
  if (!variant.isAvailable) {
    return <span className="inline-block rounded bg-blush-100 px-3 py-1 text-sm text-cocoa-500">Out of stock</span>;
  }

  if (fulfillmentType === 'MADE_TO_ORDER') {
    return (
      <span className="inline-block rounded bg-blush-50 px-3 py-1 text-sm text-blush-700">
        Made to order{productionDays ? ` · ~${productionDays} days` : ''}
      </span>
    );
  }

  if (variant.stockQuantity !== null && variant.stockQuantity <= 5) {
    return (
      <span className="inline-block rounded bg-amber-50 px-3 py-1 text-sm text-amber-700">
        Only {variant.stockQuantity} left
      </span>
    );
  }

  return <span className="inline-block rounded bg-blush-50 px-3 py-1 text-sm text-blush-600">In stock</span>;
}

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, loading, error, refetch } = useApi<ProductDetail>(
    slug ? `/api/v1/products/${slug}` : null,
  );

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  const variant = selectedVariant ?? product?.variants[0] ?? null;

  if (loading) return <PageSpinner />;

  if (error) {
    if (error === 'Product not found') {
      return (
        <div className="container-page py-8">
          <EmptyState
            title="Product not found"
            description="This product doesn't exist or is no longer available."
            actionLabel="Browse all products"
            actionTo="/shop"
          />
        </div>
      );
    }
    return (
      <div className="container-page py-8">
        <ErrorMessage message={error} onRetry={refetch} />
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="container-page py-8">
      <Breadcrumbs
        items={[
          { label: 'Shop', to: '/shop' },
          ...(product.category.parent
            ? [{ label: product.category.parent.name, to: `/category/${product.category.parent.slug}` }]
            : []),
          { label: product.category.name, to: `/category/${product.category.slug}` },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        {/* Images */}
        <ImageGallery images={product.images} productName={product.name} />

        {/* Details */}
        <div>
          <h1 className="font-display text-2xl font-semibold text-cocoa-800 sm:text-3xl">
            {product.name}
          </h1>

          {variant && (
            <div className="mt-3">
              <Price
                paise={variant.priceInPaise}
                compareAtPaise={variant.compareAtPriceInPaise}
                className="text-lg"
              />
              {product.variants.length > 1 && product.variants.some((v) => v.priceInPaise !== product.variants[0]!.priceInPaise) && (
                <span className="ml-2 text-sm text-cocoa-400">
                  From {formatInr(product.minPriceInPaise)}
                </span>
              )}
            </div>
          )}

          {variant && (
            <div className="mt-3">
              <StockBadge
                variant={variant}
                fulfillmentType={product.fulfillmentType}
                productionDays={product.productionDays}
              />
            </div>
          )}

          {product.variants.length > 1 && variant && (
            <VariantSelector
              variants={product.variants}
              selected={variant}
              onSelect={setSelectedVariant}
            />
          )}

          {variant && <AddToCart key={variant.id} variant={variant} />}

          {product.shortDescription && (
            <p className="mt-4 text-sm leading-relaxed text-cocoa-500">{product.shortDescription}</p>
          )}

          {product.description && (
            <div className="mt-6 border-t border-blush-200 pt-6">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-cocoa-700">Description</h2>
              <div className="mt-2 text-sm leading-relaxed text-cocoa-500 whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}

          {variant && (
            <div className="mt-6 border-t border-blush-200 pt-6">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-cocoa-400">SKU</dt>
                  <dd className="font-medium text-cocoa-800">{variant.sku}</dd>
                </div>
                <div>
                  <dt className="text-cocoa-400">Category</dt>
                  <dd className="font-medium text-cocoa-800">{product.category.name}</dd>
                </div>
                {product.fulfillmentType === 'MADE_TO_ORDER' && product.productionDays && (
                  <div>
                    <dt className="text-cocoa-400">Production time</dt>
                    <dd className="font-medium text-cocoa-800">~{product.productionDays} days</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
