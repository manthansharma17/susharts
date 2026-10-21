import { formatInr, MAX_CART_LINE_QUANTITY, type CartLine } from '@susharts/shared';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FlowerIcon, HeartIcon } from '../components/Decor.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { QuantityStepper } from '../components/QuantityStepper.js';
import { PageSpinner, Spinner } from '../components/Spinner.js';
import { useAuth } from '../lib/auth-context.js';
import { useCart } from '../lib/cart-context.js';

function maxFor(line: CartLine): number {
  return Math.max(1, Math.min(MAX_CART_LINE_QUANTITY, line.availableQuantity ?? MAX_CART_LINE_QUANTITY));
}

function CartRow({ line }: { line: CartLine }) {
  const { setQuantity, removeItem } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const unavailable = line.issue === 'UNAVAILABLE';
  const max = maxFor(line);

  return (
    <li className={`flex gap-4 rounded-3xl bg-white p-3 shadow-sm ring-1 ${line.issue ? 'ring-amber-200' : 'ring-blush-100'}`}>
      <Link
        to={`/products/${line.product.slug}`}
        className={`h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-blush-100 sm:h-28 sm:w-28 ${unavailable ? 'opacity-50 grayscale' : ''}`}
      >
        {line.product.heroImageUrl ? (
          <img src={line.product.heroImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <FlowerIcon className="m-auto mt-7 h-10 w-10 text-blush-300 sm:mt-9" />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/products/${line.product.slug}`}
              className="line-clamp-2 font-semibold text-cocoa-800 hover:text-blush-700"
            >
              {line.product.name}
            </Link>
            {line.variant.label !== 'Default' && <p className="text-xs text-cocoa-500">{line.variant.label}</p>}
            {line.product.fulfillmentType === 'MADE_TO_ORDER' && (
              <p className="mt-1 inline-block rounded-full bg-blush-100 px-2 py-0.5 text-xs font-semibold text-blush-700">
                Made to order{line.product.productionDays ? ` · ~${line.product.productionDays} days` : ''}
              </p>
            )}
          </div>
          <p className={`shrink-0 font-display text-lg font-semibold ${line.issue ? 'text-cocoa-300 line-through' : 'text-blush-700'}`}>
            {formatInr(line.lineTotalInPaise)}
          </p>
        </div>

        {line.issue === 'UNAVAILABLE' && (
          <p className="mt-2 text-xs font-semibold text-amber-700">No longer available — please remove it.</p>
        )}
        {line.issue === 'INSUFFICIENT_STOCK' && (
          <p className="mt-2 text-xs font-semibold text-amber-700">
            {line.availableQuantity ? `Only ${line.availableQuantity} left — lower the quantity.` : 'Out of stock — please remove it.'}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
          {!unavailable && (
            <>
              <QuantityStepper
                value={line.quantity}
                max={max}
                disabled={busy}
                label={`Quantity of ${line.product.name}`}
                // If stock dropped below the cart quantity, "−" jumps straight to what's available.
                onChange={(next) => void run(() => setQuantity(line.variantId, Math.min(next, max)))}
              />
              <span className="text-xs text-cocoa-400">{formatInr(line.variant.priceInPaise)} each</span>
            </>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => removeItem(line.variantId))}
            className="ml-auto rounded-full px-3 py-1 text-xs font-semibold text-cocoa-500 hover:bg-blush-50 hover:text-blush-700 disabled:opacity-50"
          >
            Remove
          </button>
          {busy && <Spinner className="h-4 w-4" />}
        </div>
        {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
      </div>
    </li>
  );
}

export function CartPage() {
  const { cart, loading, error, refresh, clear } = useCart();
  const { user, signInWithGoogle } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  if (loading && !cart) return <PageSpinner />;

  if (error && !cart) {
    return (
      <div className="container-page py-10">
        <ErrorMessage message={error} onRetry={() => void refresh()} />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white px-6 py-14 text-center shadow-soft ring-1 ring-blush-100">
          <HeartIcon className="mx-auto h-12 w-12 text-blush-300" />
          <h1 className="mt-4 font-display text-2xl font-semibold text-cocoa-800">Your cart is empty</h1>
          <p className="mt-2 text-sm text-cocoa-500">Find something handmade you'll love.</p>
          <Link to="/shop" className="btn-primary mt-6">
            Start shopping →
          </Link>
        </div>
      </div>
    );
  }

  async function handleClear() {
    if (!window.confirm('Remove everything from your cart?')) return;
    setClearing(true);
    setClearError(null);
    try {
      await clear();
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setClearing(false);
    }
  }

  const hasMadeToOrder = cart.items.some((l) => l.product.fulfillmentType === 'MADE_TO_ORDER' && !l.issue);

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-3xl font-semibold text-cocoa-800 sm:text-4xl">
          Your cart <HeartIcon filled className="h-6 w-6 text-blush-400" />
        </h1>
        <button
          type="button"
          disabled={clearing}
          onClick={() => void handleClear()}
          className="text-sm text-cocoa-400 hover:text-blush-700 disabled:opacity-50"
        >
          Clear cart
        </button>
      </div>

      {(error || clearError) && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {clearError ?? error}
        </p>
      )}

      {cart.hasIssues && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some items have changed since you added them. They're not counted in your total until you update or remove them.
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="space-y-4">
          {cart.items.map((line) => (
            <CartRow key={line.variantId} line={line} />
          ))}
        </ul>

        <aside className="h-fit rounded-3xl bg-white p-6 shadow-soft ring-1 ring-blush-100 lg:sticky lg:top-6">
          <h2 className="font-display text-xl font-semibold text-cocoa-800">Summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-cocoa-600">
              <dt>Items</dt>
              <dd>{cart.items.filter((l) => !l.issue).reduce((n, l) => n + l.quantity, 0)}</dd>
            </div>
            <div className="flex justify-between border-t border-blush-100 pt-3 text-base font-semibold text-cocoa-800">
              <dt>Subtotal</dt>
              <dd className="font-display text-xl text-blush-700">{formatInr(cart.subtotalInPaise)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-cocoa-400">Shipping is calculated at checkout.</p>
          {hasMadeToOrder && (
            <p className="mt-3 rounded-2xl bg-blush-50 px-3 py-2 text-xs text-cocoa-600">
              Includes made-to-order pieces, crafted after you order.
            </p>
          )}

          {cart.hasIssues ? (
            <button type="button" disabled className="btn-primary mt-6 w-full">
              Fix the items above to check out
            </button>
          ) : (
            <Link to="/checkout" className="btn-primary mt-6 w-full py-3 text-base">
              Proceed to checkout →
            </Link>
          )}
          {!user && (
            <p className="mt-4 text-center text-xs text-cocoa-500">
              <button type="button" onClick={() => void signInWithGoogle()} className="font-semibold text-blush-700 hover:underline">
                Sign in
              </button>{' '}
              to save your cart across devices.
            </p>
          )}
          <Link to="/shop" className="mt-4 block text-center text-sm text-cocoa-500 hover:text-blush-700">
            ← Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
