import type { ReactNode } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useCurrentUser } from '../hooks/use-current-user.js';
import { useAuth } from '../lib/auth-context.js';
import { BowIcon } from './Decor.js';
import { PageSpinner } from './Spinner.js';

function GateCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-blush-50 px-4">
      <div className="w-full max-w-sm rounded-[2rem] bg-white p-8 text-center shadow-soft ring-1 ring-blush-100">
        <BowIcon className="mx-auto h-10 w-14 text-blush-400" />
        <h1 className="mt-3 font-display text-2xl font-semibold text-cocoa-800">{title}</h1>
        {children}
      </div>
    </div>
  );
}

const navLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 text-sm font-medium transition ${
    isActive ? 'bg-blush-200 text-cocoa-800' : 'text-cocoa-600 hover:bg-blush-100'
  }`;

/** Client-side gate for the admin panel. The API enforces the same role check on every request. */
export function AdminLayout() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const current = useCurrentUser();

  if (current.loading) return <PageSpinner />;

  if (!current.signedIn) {
    return (
      <GateCard title="Admin sign in">
        <p className="mt-2 text-sm text-cocoa-500">Sign in with your admin Google account to continue.</p>
        <button type="button" onClick={() => void signInWithGoogle()} className="btn-primary mt-6 w-full">
          Sign in with Google
        </button>
        <Link to="/" className="mt-4 inline-block text-xs text-cocoa-400 hover:text-blush-600">
          ← Back to store
        </Link>
      </GateCard>
    );
  }

  if (current.error || !current.isStaff) {
    return (
      <GateCard title="No access">
        <p className="mt-2 text-sm text-cocoa-500">
          {current.error ?? `${user?.email ?? 'This account'} is not an admin.`}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link to="/" className="btn-secondary">
            Back to store
          </Link>
          <button type="button" onClick={() => void signOut()} className="btn-primary">
            Switch account
          </button>
        </div>
      </GateCard>
    );
  }

  return (
    <div className="min-h-screen bg-blush-50">
      <header className="border-b border-blush-100 bg-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-4">
            <Link to="/admin" className="flex items-center gap-2">
              <BowIcon className="h-7 w-9 text-blush-500" />
              <span className="font-display text-xl font-semibold text-cocoa-800">
                Susharts <span className="text-blush-600">Admin</span>
              </span>
            </Link>
            <nav aria-label="Admin" className="flex gap-1">
              <NavLink to="/admin" end className={navLink}>
                Products
              </NavLink>
              <NavLink to="/admin/categories" className={navLink}>
                Categories
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-cocoa-500 hover:text-blush-600">
              View store ↗
            </Link>
            <span className="hidden text-cocoa-400 sm:inline">{user?.email}</span>
            <button type="button" onClick={() => void signOut()} className="btn-secondary px-3 py-1 text-xs">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
    </div>
  );
}
