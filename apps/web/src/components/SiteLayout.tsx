import type { CategoryTreeNode } from '@susharts/shared';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/use-api.js';
import { useAuth } from '../lib/auth-context.js';
import { useCart } from '../lib/cart-context.js';
import { BowIcon, HeartIcon } from './Decor.js';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="Susharts home">
      <BowIcon className="h-9 w-11 text-blush-500" />
      <span className="leading-none">
        <span className="flex items-center gap-1 font-display text-2xl font-semibold text-cocoa-800 sm:text-3xl">
          Susharts
          <HeartIcon filled className="h-3.5 w-3.5 text-blush-400" />
        </span>
        <span className="mt-1 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-cocoa-400 sm:block">
          Crochet <span className="text-blush-400">♡</span> Pipe cleaner{' '}
          <span className="text-blush-400">♡</span> Handmade
        </span>
      </span>
    </Link>
  );
}

function HeaderSearch({ className = '' }: { className?: string }) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={`relative flex w-full ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
        navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
      }}
    >
      <label htmlFor="site-search" className="sr-only">
        Search products
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        placeholder="Search for keychains, flowers, crochet plushies…"
        className="w-full rounded-full border border-blush-200 bg-white py-2.5 pl-5 pr-14 text-sm text-cocoa-800 placeholder:text-cocoa-300 focus:border-blush-400 focus:outline-none focus:ring-2 focus:ring-blush-200"
      />
      <button
        type="submit"
        className="absolute inset-y-1 right-1 flex w-11 items-center justify-center rounded-full bg-blush-500 text-white transition hover:bg-blush-600"
        aria-label="Search"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
          <path strokeLinecap="round" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
        </svg>
      </button>
    </form>
  );
}

function CartButton() {
  const { itemCount } = useCart();
  return (
    <Link
      to="/cart"
      className="relative flex flex-col items-center gap-0.5 text-cocoa-600 transition hover:text-blush-600"
      aria-label={`Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}`}
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7} aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2M10 20.5h.01M17 20.5h.01"
        />
      </svg>
      <span className="text-xs font-medium" aria-hidden="true">
        Cart
      </span>
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-blush-600 px-1 text-[10px] font-bold text-white"
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  );
}

function AccountButton() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  if (loading) return <div className="h-10 w-16" />;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-9 w-9 rounded-full ring-2 ring-blush-200"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <div className="hidden text-left text-xs leading-tight md:block">
          <span className="block max-w-[9rem] truncate font-semibold text-cocoa-700">
            {user.displayName ?? user.email}
          </span>
          <button type="button" onClick={() => void signOut()} className="text-cocoa-400 hover:text-blush-600">
            Sign out
          </button>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs font-semibold text-cocoa-500 hover:text-blush-600 md:hidden"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithGoogle()}
      className="flex flex-col items-center gap-0.5 text-cocoa-600 transition hover:text-blush-600"
    >
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4.5 20.5a7.5 7.5 0 0 1 15 0"
        />
      </svg>
      <span className="text-xs font-medium">Sign in</span>
    </button>
  );
}

const navPill = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-blush-200 text-cocoa-800' : 'text-cocoa-600 hover:bg-blush-100 hover:text-cocoa-800'
  }`;

export function SiteLayout() {
  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <div className="bg-blush-400 text-white">
        <div className="container-page flex h-9 items-center justify-center gap-2 text-xs font-medium sm:justify-between">
          <p className="flex items-center gap-2">
            <HeartIcon filled className="h-3 w-3" /> Handmade with love
            <span className="hidden items-center gap-2 sm:inline-flex">
              <HeartIcon className="h-3 w-3" /> Unique crochet &amp; pipe cleaner creations
            </span>
          </p>
          <p className="hidden items-center gap-2 sm:flex">
            Every piece is made by hand in India <HeartIcon filled className="h-3 w-3" />
          </p>
        </div>
      </div>

      <header className="border-b border-blush-100 bg-blush-50/90 backdrop-blur">
        <div className="container-page flex items-center justify-between gap-6 py-4">
          <Logo />
          <HeaderSearch className="hidden max-w-xl md:flex" />
          <div className="flex items-center gap-5">
            <CartButton />
            <AccountButton />
          </div>
        </div>
        <div className="container-page pb-3 md:hidden">
          <HeaderSearch />
        </div>
        <nav aria-label="Main" className="container-page pb-3">
          <ul className="-mx-1 flex items-center gap-1 overflow-x-auto md:justify-center">
            <li>
              <NavLink to="/" end className={navPill}>
                Home
              </NavLink>
            </li>
            <li>
              <NavLink to="/shop" className={navPill}>
                Shop all
              </NavLink>
            </li>
            {categories.data?.map((cat) => (
              <li key={cat.id}>
                <NavLink to={`/category/${cat.slug}`} className={navPill}>
                  {cat.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-16 border-t border-blush-200 bg-blush-100">
        <div className="container-page py-12">
          <div className="grid gap-10 sm:grid-cols-3">
            <div>
              <Logo />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-cocoa-500">
                Handmade crochet and pipe-cleaner creations, crafted stitch by stitch in India.
              </p>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-cocoa-800">Shop</h3>
              <ul className="mt-3 space-y-2 text-sm text-cocoa-500">
                <li>
                  <Link to="/shop" className="hover:text-blush-600">
                    All products
                  </Link>
                </li>
                {categories.data?.slice(0, 5).map((cat) => (
                  <li key={cat.id}>
                    <Link to={`/category/${cat.slug}`} className="hover:text-blush-600">
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-display text-base font-semibold text-cocoa-800">About</h3>
              <p className="mt-3 text-sm leading-relaxed text-cocoa-500">
                Each piece is handmade with care and attention to detail, so no two are ever quite the
                same.
              </p>
            </div>
          </div>
          <div className="mt-10 flex items-center justify-center gap-1.5 border-t border-blush-200 pt-6 text-xs text-cocoa-400">
            © {new Date().getFullYear()} Susharts · Handmade with
            <HeartIcon filled className="h-3 w-3 text-blush-400" /> in India
          </div>
        </div>
      </footer>
    </div>
  );
}
