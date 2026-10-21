import type { CategoryTreeNode } from '@susharts/shared';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/use-api.js';
import { useAuth } from '../lib/auth-context.js';
import { useCart } from '../lib/cart-context.js';
import { HeartIcon } from './Decor.js';

function Monogram({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path
        d="M9 6.5c3 0 5 2.3 5.6 5.2.6-2.9 2.6-5.2 5.6-5.2 3.2 0 5.3 2.5 5.3 5.6 0 5.6-7 9.6-10.9 13.4C10.7 21.7 3.7 17.7 3.7 12.1c0-3.1 2.1-5.6 5.3-5.6Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="Susharts home">
      <Monogram className="h-6 w-6 shrink-0 text-blush-600" />
      <span className="leading-none">
        <span className="block font-display text-2xl font-semibold tracking-tight text-cocoa-800">
          Susharts
        </span>
        {!compact && (
          <span className="mt-1 block text-[9px] font-medium uppercase tracking-eyebrow text-cocoa-400">
            Handmade with love
          </span>
        )}
      </span>
    </Link>
  );
}

function SearchField({
  className = '',
  autoFocus = false,
}: {
  className?: string;
  autoFocus?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <form
      role="search"
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        const q = String(new FormData(e.currentTarget).get('q') ?? '').trim();
        navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
      }}
    >
      <label htmlFor={autoFocus ? 'site-search-mobile' : 'site-search'} className="sr-only">
        Search products
      </label>
      <svg
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cocoa-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
        />
      </svg>
      <input
        id={autoFocus ? 'site-search-mobile' : 'site-search'}
        name="q"
        type="search"
        autoFocus={autoFocus}
        placeholder="Search handmade happiness…"
        className="field w-full border-blush-200 bg-white pl-11 pr-4"
      />
    </form>
  );
}

function IconLink({
  to,
  label,
  badge,
  children,
}: {
  to: string;
  label: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-label={badge !== undefined ? `${label}, ${badge} item${badge === 1 ? '' : 's'}` : label}
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-cocoa-600 transition hover:bg-blush-100 hover:text-blush-700"
    >
      {children}
      {badge !== undefined && badge > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blush-600 px-1 text-[10px] font-bold text-white"
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function AccountMenu() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) return <div className="h-10 w-10" />;

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => void signInWithGoogle()}
        aria-label="Sign in"
        className="flex h-10 w-10 items-center justify-center rounded-full text-cocoa-600 transition hover:bg-blush-100 hover:text-blush-700"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.6}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4.5 20.5a7.5 7.5 0 0 1 15 0"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-blush-100"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-7 w-7 rounded-full ring-1 ring-blush-300"
            referrerPolicy="no-referrer"
          />
        ) : (
          <svg
            className="h-5 w-5 text-cocoa-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.6}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4.5 20.5a7.5 7.5 0 0 1 15 0"
            />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-30 w-56 rounded-2xl border border-blush-200 bg-white p-2 shadow-lift">
          <p className="truncate px-3 py-2 text-xs text-cocoa-400">{user.email}</p>
          <Link
            to="/orders"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-cocoa-700 hover:bg-blush-100"
          >
            My orders
          </Link>
          <Link
            to="/cart"
            onClick={() => setOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-cocoa-700 hover:bg-blush-100"
          >
            My cart
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-cocoa-500 hover:bg-blush-100"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `relative whitespace-nowrap py-1 text-sm transition after:absolute after:-bottom-0.5 after:left-0 after:h-px after:bg-blush-600 after:transition-all ${
    isActive
      ? 'text-cocoa-800 after:w-full'
      : 'text-cocoa-600 hover:text-cocoa-800 after:w-0 hover:after:w-full'
  }`;

export function SiteLayout() {
  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');
  const { itemCount } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const roots = categories.data ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2"
      >
        Skip to content
      </a>

      <div className="bg-blush-600 text-white">
        <div className="container-page flex h-9 items-center justify-center gap-6 text-[11px] font-medium tracking-wide">
          <p className="flex items-center gap-1.5">
            <HeartIcon filled className="h-3 w-3" /> Handmade to order in India
          </p>
          <p className="hidden sm:block">Every piece is one of a kind</p>
        </div>
      </div>

      <header className="sticky top-0 z-30 border-b border-blush-200 bg-blush-50/95 backdrop-blur">
        <div className="container-page flex h-[4.5rem] items-center gap-4">
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
            aria-label="Menu"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-cocoa-700 hover:bg-blush-100 lg:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                d={menuOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'}
              />
            </svg>
          </button>

          <Logo />

          <nav aria-label="Main" className="ml-6 hidden items-center gap-7 lg:flex">
            <NavLink to="/" end className={navLink}>
              Home
            </NavLink>
            <NavLink to="/shop" className={navLink}>
              Shop
            </NavLink>
            {roots.slice(0, 4).map((cat) => (
              <NavLink key={cat.id} to={`/category/${cat.slug}`} className={navLink}>
                {cat.name}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <SearchField className="hidden w-64 md:block xl:w-80" />
            <AccountMenu />
            <IconLink to="/cart" label="Cart" badge={itemCount}>
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 7h13l-1.3 9.2a2 2 0 0 1-2 1.8H9.3a2 2 0 0 1-2-1.7L5.6 4.8A1 1 0 0 0 4.6 4H3m6.5 17h.01M16 21h.01"
                />
              </svg>
            </IconLink>
          </div>
        </div>

        <div className="container-page pb-3 md:hidden">
          <SearchField />
        </div>

        {menuOpen && (
          <nav aria-label="Mobile" className="border-t border-blush-200 bg-white lg:hidden">
            <div className="container-page flex flex-col py-2">
              {[
                { to: '/', label: 'Home' },
                { to: '/shop', label: 'Shop all' },
                ...roots.map((c) => ({ to: `/category/${c.slug}`, label: c.name })),
                { to: '/orders', label: 'My orders' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="border-b border-blush-100 py-3 text-sm text-cocoa-700 last:border-0"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-blush-200 bg-blush-100">
        <div className="container-page py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Logo compact />
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-cocoa-500">
                A small studio making crochet and pipe-cleaner pieces by hand — flowers that never
                wilt, plushies with personality, and gifts made to be kept.
              </p>
            </div>
            <div>
              <h3 className="eyebrow">Shop</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-cocoa-500">
                <li>
                  <Link to="/shop" className="transition hover:text-blush-700">
                    All products
                  </Link>
                </li>
                {roots.slice(0, 5).map((cat) => (
                  <li key={cat.id}>
                    <Link to={`/category/${cat.slug}`} className="transition hover:text-blush-700">
                      {cat.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="eyebrow">Your account</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-cocoa-500">
                <li>
                  <Link to="/orders" className="transition hover:text-blush-700">
                    My orders
                  </Link>
                </li>
                <li>
                  <Link to="/cart" className="transition hover:text-blush-700">
                    My cart
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-blush-200 pt-6 text-xs text-cocoa-400 sm:flex-row">
            <p>© {new Date().getFullYear()} Susharts</p>
            <p className="flex items-center gap-1.5">
              Handmade with <HeartIcon filled className="h-3 w-3 text-blush-500" /> in India
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
