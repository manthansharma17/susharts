import { Link, Outlet } from 'react-router-dom';

export function SiteLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight text-brand-700">
            Susharts
          </Link>
          <nav aria-label="Main" className="text-sm text-slate-600">
            Catalogue coming soon
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200 py-6">
        <div className="container-page text-sm text-slate-500">
          © {new Date().getFullYear()} Susharts. Handmade in India.
        </div>
      </footer>
    </div>
  );
}
