import { formatInr, type OrderSummary } from '@susharts/shared';
import { useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HeartIcon } from '../components/Decor.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { useAuth } from '../lib/auth-context.js';

const POLL_MS = 3000;
const MAX_POLLS = 10;

export function OrderConfirmationPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const order = useApi<OrderSummary>(user && id ? `/api/v1/checkout/orders/${id}` : null);
  const polls = useRef(0);

  const pending = order.data?.status === 'PENDING_PAYMENT';
  useEffect(() => {
    if (!pending || polls.current >= MAX_POLLS) return;
    const timer = window.setTimeout(() => {
      polls.current += 1;
      order.refetch();
    }, POLL_MS);
    return () => window.clearTimeout(timer);
  }, [pending, order]);

  if (authLoading || (order.loading && !order.data)) return <PageSpinner />;
  if (!user) {
    return (
      <div className="container-page py-8">
        <EmptyState title="Sign in to view this order" actionLabel="Go to shop" actionTo="/shop" />
      </div>
    );
  }
  if (order.error === 'Order not found') {
    return (
      <div className="container-page py-8">
        <EmptyState title="Order not found" actionLabel="Go to shop" actionTo="/shop" />
      </div>
    );
  }
  if (order.error || !order.data) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={order.error ?? 'Could not load order'} onRetry={order.refetch} />
      </div>
    );
  }

  const o = order.data;
  const heading =
    o.status === 'PAID'
      ? 'Thank you for your order!'
      : o.status === 'PENDING_PAYMENT'
        ? 'Confirming your payment…'
        : 'This order was not completed';
  const hasMadeToOrder = o.items.some((i) => i.fulfillmentType === 'MADE_TO_ORDER');

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="rounded-[2rem] bg-white p-6 text-center shadow-soft ring-1 ring-blush-100 sm:p-10">
        <HeartIcon filled={o.status === 'PAID'} className="mx-auto h-12 w-12 text-blush-500" />
        <h1 className="mt-4 font-display text-3xl font-semibold text-cocoa-800">{heading}</h1>
        <p className="mt-2 text-sm text-cocoa-500">Order {o.orderNumber}</p>

        {o.status === 'PAID' && (
          <p className="mx-auto mt-4 max-w-md text-sm text-cocoa-600">
            Your payment was received.
            {hasMadeToOrder ? ' Made-to-order pieces will be crafted for you before shipping.' : ''}
          </p>
        )}
        {o.status === 'PENDING_PAYMENT' && (
          <p className="mx-auto mt-4 max-w-md text-sm text-cocoa-600">
            {polls.current >= MAX_POLLS
              ? "We haven't received confirmation from the bank yet. If money was deducted, your order will update automatically once Razorpay confirms it — please don't pay again."
              : 'This usually takes a few seconds. Please keep this page open.'}
          </p>
        )}
        {(o.status === 'CANCELLED' || o.status === 'EXPIRED') && (
          <p className="mx-auto mt-4 max-w-md text-sm text-cocoa-600">
            No payment was completed for this order{o.status === 'EXPIRED' ? ' in time' : ''}. Your items are still
            available to buy.{' '}
            <Link to="/cart" className="font-semibold text-blush-700 hover:underline">
              Go to cart
            </Link>
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blush-100 sm:col-span-2">
          <h2 className="font-display text-lg font-semibold text-cocoa-800">Items</h2>
          <ul className="mt-3 divide-y divide-blush-100 text-sm">
            {o.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3 py-3">
                <span className="text-cocoa-700">
                  {item.productName}
                  {item.variantLabel !== 'Default' ? ` · ${item.variantLabel}` : ''} × {item.quantity}
                  {item.fulfillmentType === 'MADE_TO_ORDER' && (
                    <span className="block text-xs text-cocoa-400">
                      Made to order{item.productionDays ? ` · ~${item.productionDays} days` : ''}
                    </span>
                  )}
                </span>
                <span className="font-semibold text-cocoa-800">{formatInr(item.lineTotalInPaise)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-2 space-y-1 border-t border-blush-100 pt-3 text-sm">
            <div className="flex justify-between text-cocoa-600">
              <dt>Subtotal</dt>
              <dd>{formatInr(o.subtotalInPaise)}</dd>
            </div>
            <div className="flex justify-between text-cocoa-600">
              <dt>Shipping</dt>
              <dd>{o.shippingInPaise === 0 ? 'Free' : formatInr(o.shippingInPaise)}</dd>
            </div>
            <div className="flex justify-between pt-1 font-semibold text-cocoa-800">
              <dt>Total</dt>
              <dd className="text-blush-700">{formatInr(o.totalInPaise)}</dd>
            </div>
          </dl>
        </section>
        <section className="rounded-3xl bg-white p-6 text-sm text-cocoa-600 shadow-sm ring-1 ring-blush-100 sm:col-span-2">
          <h2 className="font-display text-lg font-semibold text-cocoa-800">Delivering to</h2>
          <p className="mt-2 font-semibold text-cocoa-800">{o.customerName}</p>
          <p>{o.address.line1}</p>
          {o.address.line2 && <p>{o.address.line2}</p>}
          <p>
            {o.address.city}, {o.address.state} {o.address.postalCode}
          </p>
          <p className="mt-2">
            {o.phone} · {o.email}
          </p>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link to="/shop" className="btn-secondary">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
