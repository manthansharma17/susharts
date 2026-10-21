import type {
  CategoryTreeNode,
  FeaturedReview,
  ProductListResponse,
  ProductSummary,
} from '@susharts/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CategoryIcon, FlowerIcon, GiftIcon, HeartIcon, SparkleIcon } from '../components/Decor.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { ProductCard } from '../components/ProductCard.js';
import { PageSpinner } from '../components/Spinner.js';
import { Stars } from '../components/Stars.js';
import { useApi } from '../hooks/use-api.js';

function SectionHead({ title, subtitle, to }: { title: string; subtitle?: string; to?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-3xl font-semibold text-cocoa-800 sm:text-[2.1rem]">
          {title}
        </h2>
        {subtitle && <p className="mt-1.5 text-sm text-cocoa-500">{subtitle}</p>}
      </div>
      {to && (
        <Link to={to} className="link-arrow">
          View all <span aria-hidden="true">→</span>
        </Link>
      )}
    </div>
  );
}

function TrustItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-blush-300 text-blush-600">
        {icon}
      </span>
      <span className="text-sm leading-snug">
        <span className="block font-medium text-cocoa-800">{title}</span>
        <span className="block text-xs text-cocoa-400">{text}</span>
      </span>
    </li>
  );
}

function HeroVisual({ product }: { product: ProductSummary | null }) {
  const image = product?.heroImage;
  return (
    <div className="relative">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] bg-blush-200 sm:aspect-[5/5]">
        {image ? (
          <img
            src={image.url}
            alt={image.altText ?? product?.name ?? ''}
            className="h-full w-full object-cover"
          />
        ) : (
          <div aria-hidden="true" className="relative h-full w-full">
            <FlowerIcon className="absolute left-[18%] top-[22%] h-24 w-24 text-blush-400" />
            <FlowerIcon
              className="absolute right-[20%] top-[34%] h-16 w-16 text-white"
              center="#f0cfa0"
            />
            <FlowerIcon className="absolute bottom-[26%] left-[34%] h-20 w-20 text-blush-500" />
            <FlowerIcon
              className="absolute bottom-[18%] right-[24%] h-14 w-14 text-blush-300"
              center="#f0cfa0"
            />
          </div>
        )}
      </div>

      <div className="absolute -bottom-5 right-4 w-36 rotate-[-3deg] rounded-xl bg-white px-4 py-3 text-center shadow-soft sm:right-6 sm:w-40">
        <p className="font-display text-xs font-semibold tracking-wide text-cocoa-800">Susharts</p>
        <p className="mt-1 text-[10px] uppercase tracking-eyebrow text-cocoa-400">
          A little happiness
        </p>
        <HeartIcon filled className="mx-auto mt-1.5 h-3 w-3 text-blush-500" />
      </div>
    </div>
  );
}

function Hero({ product }: { product: ProductSummary | null }) {
  return (
    <section className="bg-blush-100">
      <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:py-20">
        <div>
          <p className="eyebrow">Handmade · Crochet · Pipe cleaner art</p>
          <h1 className="mt-5 font-display text-[2.6rem] font-semibold leading-[1.08] text-cocoa-800 sm:text-6xl">
            Little handmade things,
            <span className="mt-1 block text-blush-600">big happy hearts.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-cocoa-500">
            Crochet flowers that never wilt, pipe-cleaner bouquets and soft little plushies — each
            one made by hand for your special moments.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className="btn-primary px-8 py-3 text-[15px]">
              Shop collection <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ul className="mt-10 grid gap-5 sm:grid-cols-3">
            <TrustItem
              icon={<HeartIcon className="h-5 w-5" />}
              title="Handmade with love"
              text="Stitch by stitch"
            />
            <TrustItem
              icon={<SparkleIcon className="h-5 w-5" />}
              title="One of a kind"
              text="No two are alike"
            />
            <TrustItem
              icon={<GiftIcon className="h-5 w-5" />}
              title="Perfect for gifting"
              text="Ready to give"
            />
          </ul>
        </div>

        <div>
          <HeroVisual product={product} />
          <p className="mt-9 font-script text-[1.6rem] leading-tight text-blush-600 sm:text-3xl">
            Happiness looks handmade
          </p>
        </div>
      </div>
    </section>
  );
}

function CategoryStrip() {
  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');
  const flat = (categories.data ?? []).flatMap((root) => [root, ...root.children]).slice(0, 8);
  if (categories.loading || flat.length === 0) return null;

  return (
    <section aria-labelledby="shop-by-category" className="border-b border-blush-200 bg-blush-50">
      <div className="container-page py-10">
        <h2 id="shop-by-category" className="sr-only">
          Shop by category
        </h2>
        <ul className="flex gap-7 overflow-x-auto pb-2 sm:justify-center sm:gap-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {flat.map((cat) => (
            <li key={cat.id} className="shrink-0">
              <Link
                to={`/category/${cat.slug}`}
                className="group flex w-[5.5rem] flex-col items-center gap-3 text-center"
              >
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-blush-100 text-blush-600 ring-1 ring-blush-200 transition group-hover:ring-blush-500 sm:h-[5.5rem] sm:w-[5.5rem]">
                  {cat.imageUrl ? (
                    <img
                      src={cat.imageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <CategoryIcon slug={cat.slug} name={cat.name} className="h-9 w-9" />
                  )}
                </span>
                <span className="text-[13px] leading-tight text-cocoa-600 transition group-hover:text-blush-700">
                  {cat.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ProductRow({
  title,
  subtitle,
  path,
  emptyNote,
}: {
  title: string;
  subtitle: string;
  path: string;
  emptyNote?: string;
}) {
  const products = useApi<ProductListResponse>(path);

  if (products.loading) return <PageSpinner />;
  if (products.error) {
    return (
      <div className="container-page py-10">
        <ErrorMessage message={products.error} onRetry={products.refetch} />
      </div>
    );
  }
  const items = products.data?.items ?? [];
  if (items.length === 0 && !emptyNote) return null;

  return (
    <section className="container-page py-14">
      <SectionHead title={title} subtitle={subtitle} to="/shop" />
      {items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-blush-300 px-6 py-16 text-center">
          <FlowerIcon className="mx-auto h-10 w-10 text-blush-300" />
          <p className="mt-4 font-display text-lg text-cocoa-700">{emptyNote}</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-9 md:grid-cols-3 lg:grid-cols-4">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </section>
  );
}

function GiftBand() {
  return (
    <section className="container-page">
      <div className="relative overflow-hidden rounded-[1.75rem] bg-blush-100 px-6 py-14 sm:px-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/3 lg:block"
        >
          <FlowerIcon className="absolute right-10 top-10 h-20 w-20 text-blush-300" />
          <FlowerIcon
            className="absolute bottom-10 right-32 h-14 w-14 text-white"
            center="#f0cfa0"
          />
          <SparkleIcon className="absolute right-48 top-20 h-8 w-8 text-blush-400" />
        </div>
        <div className="relative max-w-lg">
          <p className="eyebrow">Gifting</p>
          <h2 className="mt-4 font-display text-3xl font-semibold leading-tight text-cocoa-800 sm:text-4xl">
            Made for meaningful moments
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-cocoa-500">
            Birthdays, anniversaries, or just because — a handmade piece says it in a way nothing
            off a shelf can.
          </p>
          <Link to="/shop" className="btn-primary mt-7">
            Find a gift <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Real published reviews — nothing here is written by us. Hidden when there are none. */
function Testimonials() {
  const reviews = useApi<FeaturedReview[]>('/api/v1/reviews/featured?limit=3');
  const items = reviews.data ?? [];
  if (reviews.loading || items.length === 0) return null;

  return (
    <section className="bg-blush-100">
      <div className="container-page py-16">
        <div className="text-center">
          <p className="eyebrow">Kind words</p>
          <h2 className="mt-4 font-display text-3xl font-semibold text-cocoa-800 sm:text-4xl">
            What our customers say
          </h2>
        </div>
        <ul className="mt-10 grid gap-5 md:grid-cols-3">
          {items.map((review) => (
            <li key={review.id} className="rounded-2xl bg-white p-6 shadow-soft">
              <Stars value={review.rating} size="sm" />
              <p className="mt-3 line-clamp-5 text-[15px] leading-relaxed text-cocoa-600">
                “{review.body}”
              </p>
              <div className="mt-5 flex items-center gap-3 border-t border-blush-100 pt-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blush-100 text-sm font-semibold text-blush-700">
                  {review.author.initial}
                </span>
                <span className="text-sm">
                  <span className="block font-medium text-cocoa-800">{review.author.name}</span>
                  <Link
                    to={`/products/${review.product.slug}`}
                    className="block text-xs text-cocoa-400 hover:text-blush-700"
                  >
                    {review.product.name}
                  </Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Story() {
  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Our story</p>
        <h2 className="mt-4 font-display text-3xl font-semibold leading-snug text-cocoa-800 sm:text-4xl">
          A small studio, a lot of heart
        </h2>
        <p className="mt-5 text-[15px] leading-relaxed text-cocoa-500">
          Susharts began with a hook, a ball of yarn and the idea that something made slowly by hand
          carries a little of the maker with it. Every flower is shaped petal by petal, and every
          plushie is stitched to be held.
        </p>
        <p className="mt-3 font-script text-2xl text-blush-600">Handmade, always</p>
      </div>
    </section>
  );
}

export function HomePage() {
  // The hero photograph is a real product image; it is never a stock placeholder.
  const featured = useApi<ProductListResponse>('/api/v1/products?limit=8&sort=position&order=asc');
  const heroProduct = featured.data?.items.find((p) => p.heroImage) ?? null;

  return (
    <>
      <Hero product={heroProduct} />
      <CategoryStrip />
      <ProductRow
        title="Featured products"
        subtitle="Handpicked favourites, made to brighten your day."
        path="/api/v1/products?limit=8&sort=position&order=asc"
        emptyNote="New creations are on the hook — check back soon."
      />
      <GiftBand />
      <ProductRow
        title="New arrivals"
        subtitle="Fresh off the hook."
        path="/api/v1/products?limit=4&sort=createdAt&order=desc"
      />
      <Testimonials />
      <Story />
    </>
  );
}
