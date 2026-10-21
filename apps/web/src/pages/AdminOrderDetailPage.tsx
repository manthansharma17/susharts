import {
  formatInr,
  type AdminOrderDetailExtras,
  type FulfillmentStatus,
  type OrderSummary,
} from '@susharts/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import {
  formatDateTime,
  FULFILLMENT_LABELS,
  OrderStatusBadge,
  PaymentBadge,
} from '../components/OrderStatusBadge.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { errorText } from '../lib/admin-utils.js';
import { apiFetch } from '../lib/api-client.js';

type Detail = OrderSummary & AdminOrderDetailExtras;
type Target = Exclude<FulfillmentStatus, 'CONFIRMED'>;

const ACTION_LABELS: Record<Target, string> = {
  PROCESSING: 'Start preparing',
  SHIPPED: 'Mark as shipped',
  DELIVERED: 'Mark as delivered',
  CANCELLED: 'Cancel order',
};

const EMAIL_LABELS: Record<AdminOrderDetailExtras['notifications'][number]['type'], string> = {
  ORDER_CONFIRMED: 'Order confirmation',
  PAYMENT_FAILED: 'Payment failed',
  ORDER_SHIPPED: 'Shipped',
  ORDER_DELIVERED: 'Delivered',
  ORDER_CANCELLED: 'Cancelled',
};

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-blush-100 sm:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-cocoa-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionForm({
  order,
  target,
  onDone,
  onCancel,
}: {
  order: Detail;
  target: Target;
  onDone: (d: Detail) => void;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelling = target === 'CANCELLED';

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (cancelling && !note.trim()) {
      setError('Please give a reason for cancelling.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await apiFetch<Detail>(`/api/v1/admin/orders/${order.id}/fulfillment`, {
        method: 'PATCH',
        body: JSON.stringify({
          from: order.fulfillmentStatus,
          to: target,
          note: note.trim() || null,
          ...(target === 'SHIPPED'
            ? { shippingCarrier: carrier.trim(), trackingNumber: tracking.trim() }
            : {}),
        }),
      });
      onDone(updated);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-4 space-y-3 rounded-2xl bg-blush-50 p-4 ring-1 ring-blush-100"
      noValidate
    >
      <p className="text-sm font-semibold text-cocoa-800">{ACTION_LABELS[target]}</p>
      {target === 'SHIPPED' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ship-carrier" className="block text-xs font-semibold text-cocoa-600">
              Courier (optional)
            </label>
            <input
              id="ship-carrier"
              value={carrier}
              maxLength={100}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g. India Post, Delhivery"
              className="field mt-1 w-full"
            />
          </div>
          <div>
            <label htmlFor="ship-tracking" className="block text-xs font-semibold text-cocoa-600">
              Tracking number (optional)
            </label>
            <input
              id="ship-tracking"
              value={tracking}
              maxLength={100}
              onChange={(e) => setTracking(e.target.value)}
              className="field mt-1 w-full"
            />
          </div>
        </div>
      )}
      <div>
        <label htmlFor="action-note" className="block text-xs font-semibold text-cocoa-600">
          {cancelling ? 'Reason (required, internal)' : 'Internal note (optional)'}
        </label>
        <input
          id="action-note"
          value={note}
          maxLength={500}
          onChange={(e) => setNote(e.target.value)}
          className="field mt-1 w-full"
        />
      </div>
      {cancelling && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This order is paid. Cancelling returns its stock and emails the customer, but does{' '}
          <strong>not</strong> refund them — issue the refund in the Razorpay dashboard.
        </p>
      )}
      {(target === 'SHIPPED' || target === 'DELIVERED' || cancelling) && (
        <p className="text-xs text-cocoa-400">The customer will be emailed about this update.</p>
      )}
      {error && <p className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className={cancelling ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'}
        >
          {busy ? 'Saving…' : `Confirm: ${ACTION_LABELS[target]}`}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Back
        </button>
      </div>
    </form>
  );
}

export function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const fetched = useApi<Detail>(id ? `/api/v1/admin/orders/${id}` : null);
  const [order, setOrder] = useState<Detail | null>(null);
  const [action, setAction] = useState<Target | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (fetched.data) setOrder(fetched.data);
  }, [fetched.data]);

  if (fetched.loading && !order) return <PageSpinner />;
  if (fetched.error === 'Order not found') {
    return (
      <div className="container-page py-8">
        <EmptyState title="Order not found" actionLabel="All orders" actionTo="/admin/orders" />
      </div>
    );
  }
  if (fetched.error || !order) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={fetched.error ?? 'Could not load order'} onRetry={fetched.refetch} />
      </div>
    );
  }

  const o = order;
  const unsentEmails = o.notifications.filter((n) => n.status !== 'SENT' && n.attempts < 5);

  async function retryEmails() {
    setRetrying(true);
    setMessage(null);
    try {
      setOrder(
        await apiFetch<Detail>(`/api/v1/admin/orders/${o.id}/notifications/retry`, {
          method: 'POST',
        }),
      );
    } catch (err) {
      setMessage(errorText(err));
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="container-page max-w-5xl py-8">
      <Link to="/admin/orders" className="text-sm text-cocoa-500 hover:text-blush-600">
        ← All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-semibold text-cocoa-800">{o.orderNumber}</h1>
        <PaymentBadge status={o.status} />
        <OrderStatusBadge status={o.status} fulfillment={o.fulfillmentStatus} />
      </div>
      <p className="mt-1 text-sm text-cocoa-400">
        Placed {formatDateTime(o.createdAt)}
        {o.paidAt ? ` · Paid ${formatDateTime(o.paidAt)}` : ''}
      </p>

      {o.requiresReview && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <strong>Needs review:</strong> {o.reviewReason ?? 'See payment details.'}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card title="Fulfilment">
            {o.status !== 'PAID' ? (
              <p className="text-sm text-cocoa-500">
                This order is not paid, so it cannot be fulfilled. Payment status only changes
                through verified Razorpay payments.
              </p>
            ) : o.allowedTransitions.length === 0 ? (
              <p className="text-sm text-cocoa-500">
                This order is {FULFILLMENT_LABELS[o.fulfillmentStatus ?? 'CONFIRMED'].toLowerCase()}
                . No further steps.
              </p>
            ) : (
              <>
                <p className="text-sm text-cocoa-600">
                  Current step:{' '}
                  <strong>{FULFILLMENT_LABELS[o.fulfillmentStatus ?? 'CONFIRMED']}</strong>
                </p>
                {!action && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {o.allowedTransitions.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAction(t as Target)}
                        className={
                          t === 'CANCELLED'
                            ? 'btn rounded-full border border-red-200 bg-white text-red-700 hover:bg-red-50'
                            : 'btn-primary'
                        }
                      >
                        {ACTION_LABELS[t as Target]}
                      </button>
                    ))}
                  </div>
                )}
                {action && (
                  <ActionForm
                    order={o}
                    target={action}
                    onCancel={() => setAction(null)}
                    onDone={(d) => {
                      setOrder(d);
                      setAction(null);
                    }}
                  />
                )}
              </>
            )}
            {(o.shippingCarrier || o.trackingNumber) && (
              <p className="mt-4 text-sm text-cocoa-600">
                Shipping: {o.shippingCarrier ?? '—'} · Tracking: {o.trackingNumber ?? '—'}
              </p>
            )}
          </Card>

          <Card title="Items">
            <ul className="divide-y divide-blush-100 text-sm">
              {o.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3 py-2.5">
                  <span className="text-cocoa-700">
                    {item.productName}
                    {item.variantLabel !== 'Default' ? ` · ${item.variantLabel}` : ''}
                    <span className="block text-xs text-cocoa-400">
                      {formatInr(item.unitPriceInPaise)} × {item.quantity}
                      {item.fulfillmentType === 'MADE_TO_ORDER'
                        ? ` · Made to order${item.productionDays ? ` (~${item.productionDays} days)` : ''}`
                        : ''}
                    </span>
                  </span>
                  <span className="font-semibold text-cocoa-800">
                    {formatInr(item.lineTotalInPaise)}
                  </span>
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
              <div className="flex justify-between font-semibold text-cocoa-800">
                <dt>Total</dt>
                <dd className="text-blush-700">{formatInr(o.totalInPaise)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="History">
            {o.events.length === 0 ? (
              <p className="text-sm text-cocoa-400">No fulfilment history yet.</p>
            ) : (
              <ol className="space-y-3 border-l-2 border-blush-100 pl-4 text-sm">
                {o.events.map((e, i) => (
                  <li key={i}>
                    <p className="font-semibold text-cocoa-800">
                      {e.fromStatus ? `${FULFILLMENT_LABELS[e.fromStatus]} → ` : ''}
                      {FULFILLMENT_LABELS[e.toStatus]}
                    </p>
                    <p className="text-xs text-cocoa-400">
                      {formatDateTime(e.createdAt)} · {e.actorEmail ?? 'System'}
                    </p>
                    {e.note && <p className="mt-0.5 text-xs text-cocoa-600">“{e.note}”</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Customer">
            <div className="space-y-0.5 text-sm text-cocoa-600">
              <p className="font-semibold text-cocoa-800">{o.customerName}</p>
              <p>{o.email}</p>
              <p>{o.phone}</p>
              <p className="pt-2">{o.address.line1}</p>
              {o.address.line2 && <p>{o.address.line2}</p>}
              <p>
                {o.address.city}, {o.address.state} {o.address.postalCode}
              </p>
              {o.userEmail !== o.email && (
                <p className="pt-2 text-xs text-cocoa-400">Account: {o.userEmail}</p>
              )}
            </div>
          </Card>

          <Card title="Payments">
            {o.payments.length === 0 ? (
              <p className="text-sm text-cocoa-400">No payment attempts recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.payments.map((p) => (
                  <li key={p.razorpayPaymentId} className="rounded-xl bg-blush-50 px-3 py-2">
                    <p className="flex justify-between gap-2">
                      <span
                        className={`font-semibold ${p.status === 'FAILED' ? 'text-red-700' : 'text-cocoa-800'}`}
                      >
                        {p.status === 'CAPTURED'
                          ? 'Captured'
                          : p.status === 'FAILED'
                            ? 'Failed'
                            : 'Authorized'}
                      </span>
                      <span>{formatInr(p.amountInPaise)}</span>
                    </p>
                    <p className="break-all text-xs text-cocoa-400">
                      {p.razorpayPaymentId}
                      {p.method ? ` · ${p.method}` : ''}
                    </p>
                    {p.errorDescription && (
                      <p className="text-xs text-red-700">{p.errorDescription}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {o.razorpayOrderId && (
              <p className="mt-2 break-all text-xs text-cocoa-400">
                Razorpay order {o.razorpayOrderId}
              </p>
            )}
          </Card>

          <Card
            title="Emails"
            action={
              unsentEmails.length > 0 ? (
                <button
                  type="button"
                  disabled={retrying}
                  onClick={() => void retryEmails()}
                  className="btn-secondary px-3 py-1 text-xs"
                >
                  {retrying ? 'Retrying…' : 'Retry failed'}
                </button>
              ) : undefined
            }
          >
            {o.notifications.length === 0 ? (
              <p className="text-sm text-cocoa-400">No emails sent for this order.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {o.notifications.map((n) => (
                  <li key={n.type}>
                    <p className="flex justify-between gap-2">
                      <span className="text-cocoa-700">{EMAIL_LABELS[n.type]}</span>
                      <span
                        className={`text-xs font-semibold ${
                          n.status === 'SENT'
                            ? 'text-green-700'
                            : n.status === 'FAILED'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {n.status === 'SENT'
                          ? 'Sent'
                          : n.status === 'FAILED'
                            ? `Failed (${n.attempts}×)`
                            : 'Sending'}
                      </span>
                    </p>
                    {n.lastError && n.status !== 'SENT' && (
                      <p className="break-words text-xs text-cocoa-400">{n.lastError}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
