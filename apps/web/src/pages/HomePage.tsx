import type { CategoryTreeNode, ProductListResponse } from '@susharts/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BowIcon, CategoryIcon, FlowerIcon, HeartIcon, YarnIcon } from '../components/Decor.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { ProductCard } from '../components/ProductCard.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';

function Hero() {
  return (
    <section className="container-page pt-4">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush-100 via-blush-200 to-blush-100 px-6 py-16 shadow-soft sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-10 bottom-[-3rem] h-56 w-56 rounded-full bg-blush-300/40 blur-2xl" />
          <div className="absolute -right-10 top-[-3rem] h-64 w-64 rounded-full bg-white/50 blur-2xl" />

          <div className="absolute bottom-6 left-6 hidden lg:block">
            <YarnIcon className="h-32 w-32 text-blush-400" />
            <FlowerIcon className="absolute -right-6 -top-8 h-14 w-14 text-blush-500" />
            <FlowerIcon className="absolute -top-16 left-16 h-10 w-10 text-blush-300" center="#fde6a7" />
          </div>
          <div className="absolute left-36 top-10 hidden rounded-[2rem] bg-white/80 px-5 py-4 text-center font-display text-sm leading-snug text-cocoa-700 shadow-soft lg:block">
            Crafted happiness
            <br />
            just for you
            <HeartIcon className="mx-auto mt-1 h-3.5 w-3.5 text-blush-500" />
          </div>

          <div className="absolute bottom-0 right-6 hidden h-full w-64 lg:block">
            <FlowerIcon className="absolute bottom-24 right-24 h-20 w-20 text-blush-500" />
            <FlowerIcon className="absolute bottom-36 right-6 h-16 w-16 text-blush-300" center="#fde6a7" />
            <FlowerIcon className="absolute bottom-8 right-36 h-14 w-14 text-white" />
            <FlowerIcon className="absolute bottom-10 right-4 h-20 w-20 text-blush-400" />
            <FlowerIcon className="absolute bottom-48 right-32 h-12 w-12 text-blush-400" center="#fde6a7" />
            <div className="absolute bottom-6 right-24 rotate-6 rounded-md bg-white/90 px-3 py-2 font-display text-xs text-cocoa-600 shadow-soft">
              A little happiness
              <br />
              for you ♡
            </div>
          </div>

          <BowIcon className="absolute left-[30%] top-8 hidden h-12 w-16 -rotate-12 text-blush-300 md:block" />
          <BowIcon className="absolute right-[28%] top-6 hidden h-10 w-12 rotate-12 text-blush-300 md:block" />
          <HeartIcon className="absolute bottom-10 left-[28%] hidden h-6 w-6 text-blush-400 md:block" />
          <HeartIcon className="absolute bottom-16 right-[30%] hidden h-8 w-8 text-blush-300 md:block" />
        </div>

        <div className="relative mx-auto max-w-xl text-center">
          <h1 className="font-display text-5xl font-semibold leading-[1.05] text-blush-800 sm:text-7xl">
            Handmade
            <br />
            with <span className="text-cocoa-700">Love</span>
            <HeartIcon filled className="ml-2 inline-block h-9 w-9 align-baseline text-blush-500 sm:h-12 sm:w-12" />
          </h1>
          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-cocoa-600 sm:text-lg">
            Explore our collection of crochet and pipe cleaner creations — keychains, flowers,
            bouquets, plushies and more.
          </p>
          <Link to="/shop" className="btn-primary mt-8 px-8 py-3 text-base">
            Shop now <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function CategoryCircles() {
  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');

  if (categories.loading) return <PageSpinner />;
  if (categories.error) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={categories.error} onRetry={categories.refetch} />
      </div>
    );
  }

  const flat = (categories.data ?? []).flatMap((root) => [root, ...root.children]).slice(0, 8);
  if (flat.length === 0) return null;

  return (
    <section aria-labelledby="shop-by-category" className="container-page py-10">
      <h2 id="shop-by-category" className="sr-only">
        Shop by category
      </h2>
      <ul className="flex snap-x gap-5 overflow-x-auto pb-2 sm:justify-center sm:gap-8">
        {flat.map((cat) => (
          <li key={cat.id} className="snap-start">
            <Link to={`/category/${cat.slug}`} className="group flex w-24 flex-col items-center gap-3 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-blush-200 text-blush-600 ring-4 ring-white transition group-hover:-translate-y-1 group-hover:bg-blush-300 group-hover:shadow-soft sm:h-24 sm:w-24">
                <CategoryIcon slug={cat.slug} name={cat.name} className="h-10 w-10 sm:h-11 sm:w-11" />
              </span>
              <span className="text-sm font-semibold text-cocoa-700 group-hover:text-blush-600">{cat.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TrustItem({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-center gap-3 px-2 py-2 lg:justify-center">
      <span className="text-blush-500">{icon}</span>
      <span>
        <span className="block text-sm font-semibold text-cocoa-800">{title}</span>
        <span className="block text-xs text-cocoa-400">{text}</span>
      </span>
    </li>
  );
}

const iconCls = 'h-8 w-8';

function TrustStrip() {
  return (
    <section aria-label="Why Susharts" className="border-y border-blush-100 bg-white/60">
      <ul className="container-page grid grid-cols-1 gap-2 py-5 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-blush-200">
        <TrustItem icon={<HeartIcon className={iconCls} />} title="Handmade with love" text="Unique, made by hand" />
        <TrustItem
          icon={<YarnIcon className={iconCls} />}
          title="Crochet & pipe cleaner"
          text="Two crafts, one little studio"
        />
        <TrustItem
          icon={
            <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
          title="Made to order"
          text="Crafted when you order it"
        />
        <TrustItem icon={<BowIcon className={iconCls} />} title="Made in India" text="Small-batch, thoughtfully made" />
      </ul>
    </section>
  );
}

function FeaturedProducts() {
  const featured = useApi<ProductListResponse>('/api/v1/products?limit=8&sort=createdAt&order=desc');

  return (
    <section className="container-page py-14">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-3xl font-semibold text-cocoa-800 sm:text-4xl">
            Featured products <HeartIcon filled className="h-6 w-6 text-blush-400" />
          </h2>
          <p className="mt-1 text-sm text-cocoa-500">Our newest handmade creations</p>
        </div>
        <Link to="/shop" className="btn-primary shrink-0">
          View all <span aria-hidden="true">→</span>
        </Link>
      </div>

      {featured.loading ? (
        <PageSpinner />
      ) : featured.error ? (
        <div className="mt-8">
          <ErrorMessage message={featured.error} onRetry={featured.refetch} />
        </div>
      ) : featured.data && featured.data.items.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4">
          {featured.data.items.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-blush-300 bg-white/60 px-6 py-14 text-center">
          <FlowerIcon className="mx-auto h-12 w-12 text-blush-300" />
          <p className="mt-4 font-display text-lg text-cocoa-700">New creations are on the hook!</p>
          <p className="mt-1 text-sm text-cocoa-400">Our first handmade pieces will appear here soon.</p>
        </div>
      )}
    </section>
  );
}

function Story() {
  return (
    <section className="container-page">
      <div className="relative overflow-hidden rounded-[2rem] bg-white px-6 py-14 text-center shadow-soft sm:px-16">
        <BowIcon className="mx-auto h-10 w-14 text-blush-400" />
        <h2 className="mt-3 font-display text-3xl font-semibold text-cocoa-800">Our story</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-cocoa-500">
          Every piece at Susharts is handmade with care — from delicate crochet flowers to whimsical
          pipe-cleaner sculptures. We believe in the beauty of imperfection, the warmth of handmade
          gifts, and the joy of owning something truly one-of-a-kind.
        </p>
      </div>
    </section>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <CategoryCircles />
      <TrustStrip />
      <FeaturedProducts />
      <Story />
    </>
  );
}
