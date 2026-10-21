import type { ProductSummary } from '@susharts/shared';
import { formatInr } from '@susharts/shared';
import { Link } from 'react-router-dom';
import { FlowerIcon } from './Decor.js';
import { RatingLine } from './Stars.js';

interface ProductCardProps {
  product: ProductSummary;
}

export function ProductCard({ product }: ProductCardProps) {
  const soldOut = !product.isAvailable;

  return (
    <Link to={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-xl bg-blush-100">
        {product.heroImage ? (
          <img
            src={product.heroImage.url}
            alt={product.heroImage.altText ?? product.name}
            className={`h-full w-full object-cover transition duration-700 group-hover:scale-[1.04] ${soldOut ? 'opacity-70' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FlowerIcon className="h-14 w-14 text-blush-300" />
          </div>
        )}

        {soldOut ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium tracking-wide text-cocoa-500">
            Sold out
          </span>
        ) : product.fulfillmentType === 'MADE_TO_ORDER' ? (
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium tracking-wide text-blush-700">
            Made to order
          </span>
        ) : null}
      </div>

      <div className="pt-3.5">
        <h3 className="line-clamp-1 text-[15px] font-medium text-cocoa-800 transition group-hover:text-blush-700">
          {product.name}
        </h3>
        {product.shortDescription && (
          <p className="mt-0.5 line-clamp-1 text-xs text-cocoa-400">{product.shortDescription}</p>
        )}
        <RatingLine average={product.ratingAverage} count={product.ratingCount} />
        <p className="mt-1.5 text-[15px] font-semibold text-blush-700">
          {formatInr(product.minPriceInPaise)}
        </p>
      </div>
    </Link>
  );
}
