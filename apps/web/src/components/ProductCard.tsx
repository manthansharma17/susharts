import type { ProductSummary } from '@susharts/shared';
import { formatInr } from '@susharts/shared';
import { Link } from 'react-router-dom';
import { FlowerIcon } from './Decor.js';

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-3xl bg-white p-2 shadow-sm ring-1 ring-blush-100 transition hover:-translate-y-1 hover:shadow-soft"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-blush-100">
        {product.heroImage ? (
          <img
            src={product.heroImage.url}
            alt={product.heroImage.altText ?? product.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FlowerIcon className="h-14 w-14 text-blush-300" />
          </div>
        )}
        {!product.isAvailable ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-cocoa-500">
            Sold out
          </span>
        ) : product.fulfillmentType === 'MADE_TO_ORDER' ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-blush-700">
            Made to order
          </span>
        ) : null}
      </div>

      <div className="px-2 pb-2 pt-3">
        <h3 className="line-clamp-1 font-semibold text-cocoa-800 group-hover:text-blush-700">{product.name}</h3>
        {product.shortDescription && (
          <p className="mt-0.5 line-clamp-1 text-xs text-cocoa-400">{product.shortDescription}</p>
        )}
        <p className="mt-2 font-display text-lg font-semibold text-blush-700">
          {formatInr(product.minPriceInPaise)}
        </p>
      </div>
    </Link>
  );
}
