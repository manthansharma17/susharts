import {
  formatInr,
  INDIAN_STATES,
  SHIPPING_FEE_IN_PAISE,
  type CheckoutSession,
  type OrderSummary,
} from '@susharts/shared';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { FlowerIcon } from '../components/Decor.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { PageSpinner } from '../components/Spinner.js';
import { apiFetch, ApiRequestError } from '../lib/api-client.js';
import { useAuth } from '../lib/auth-context.js';
import { useCart } from '../lib/cart-context.js';
import { loadRazorpay, openRazorpay } from '../lib/razorpay-checkout.js';

interface Form {
  customerName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
}

type FieldErrors = Partial<Record<keyof Form, string>>;

function validate(f: Form): FieldErrors {
  const e: FieldErrors = {};
  if (!f.customerName.trim()) e.customerName = 'Enter your full name';
  if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
  const phone = f.phone.replace(/[\s-]/g, '').replace(/^(\+91|91|0)(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(phone)) e.phone = 'Enter a valid 10-digit mobile number';
  if (!f.addressLine1.trim()) e.addressLine1 = 'Enter your address';
  if (!f.city.trim()) e.city = 'Enter your city';
  if (!f.state) e.state = 'Choose your state';
  if (!/^[1-9]\d{5}$/.test(f.postalCode.trim())) e.postalCode = 'Enter a valid 6-digit PIN code';
  return e;
}

function Field({
  id,
  label,
  error,
  children,
  className = '',
}: {
  id: string;
  label: string;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-xs font-semibold text-cocoa-600">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutPage() {
  const { user, loading: authLoading, signInWithGoogle } = useAuth();
  const { cart, loading: cartLoading, error: cartError, refresh } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form>({
    customerName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
  });
  const [prefilled, setPrefilled] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'starting' | 'paying' | 'verifying'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  if (user && !prefilled) {
    setPrefilled(true);
    setForm((f) => ({
      ...f,
      customerName: f.customerName || user.displayName || '',
      email: f.email || user.email || '',
    }));
  }

  if (authLoading || (cartLoading && !cart)) return <PageSpinner />;

  if (!user) {
    return (
      <div className="container-page py-16">
        <div className="mx-auto max-w-md rounded-[2rem] bg-white px-6 py-12 text-center shadow-soft ring-1 ring-blush-100">
          <h1 className="font-display text-2xl font-semibold text-cocoa-800">
            Sign in to check out
          </h1>
          <p className="mt-2 text-sm text-cocoa-500">Your cart will be saved to your account.</p>
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="btn-primary mt-6"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  if (cartError && !cart) {
    return (
      <div className="container-page py-10">
        <ErrorMessage message={cartError} onRetry={() => void refresh()} />
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    if (status === 'idle') return <Navigate to="/cart" replace />;
    return <PageSpinner />;
  }

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };
  const total = cart.subtotalInPaise + SHIPPING_FEE_IN_PAISE;
  const busy = status !== 'idle';

  async function cancel(orderId: string) {
    try {
      await apiFetch<OrderSummary>(`/api/v1/checkout/${orderId}/cancel`, { method: 'POST' });
    } catch {
      // The reservation also expires on its own; nothing else to do here.
    }
    await refresh();
  }

  async function pay(e: FormEvent) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    setStatus('starting');
    setMessage(null);
    let session: CheckoutSession;
    try {
      await loadRazorpay();
      session = await apiFetch<CheckoutSession>('/api/v1/checkout', {
        method: 'POST',
        body: JSON.stringify({ ...form, addressLine2: form.addressLine2 || null }),
      });
    } catch (err) {
      setStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Could not start checkout');
      if (err instanceof ApiRequestError && err.status === 409) await refresh();
      return;
    }

    setStatus('paying');
    let settled = false;
    try {
      openRazorpay(
        {
          key: session.razorpayKeyId,
          amount: session.amountInPaise,
          currency: session.currency,
          order_id: session.razorpayOrderId,
          name: 'Susharts',
          description: `Order ${session.orderNumber}`,
          prefill: {
            name: session.customer.name,
            email: session.customer.email,
            contact: session.customer.phone,
          },
          notes: { orderNumber: session.orderNumber },
          theme: { color: '#d05a7a' },
          modal: {
            confirm_close: true,
            ondismiss: () => {
              if (settled) return;
              setStatus('idle');
              setMessage('Payment was cancelled. Your cart is still here whenever you are ready.');
              void cancel(session.orderId);
            },
          },
          handler: (response) => {
            settled = true;
            setStatus('verifying');
            // The server re-verifies the signature and checks the payment with Razorpay before marking it paid.
            apiFetch<OrderSummary>(`/api/v1/checkout/${session.orderId}/verify`, {
              method: 'POST',
              body: JSON.stringify(response),
            })
              .catch(() => null)
              .finally(() => {
                void refresh();
                navigate(`/orders/${session.orderId}`, { replace: true });
              });
          },
        },
        (failure) => {
          // Razorpay keeps the window open so the customer can try another method.
          setMessage(
            failure.error.description ?? 'Payment failed. You can try again in the payment window.',
          );
        },
      );
    } catch (err) {
      setStatus('idle');
      setMessage(err instanceof Error ? err.message : 'Could not open the payment window');
      void cancel(session.orderId);
    }
  }

  return (
    <div className="container-page py-8">
      <Link to="/cart" className="text-sm text-cocoa-500 hover:text-blush-600">
        ← Back to cart
      </Link>
      <h1 className="mt-3 font-display text-3xl font-semibold text-cocoa-800 sm:text-4xl">
        Checkout
      </h1>

      {cart.hasIssues && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Some items in your cart have changed.{' '}
          <Link to="/cart" className="font-semibold underline">
            Review your cart
          </Link>{' '}
          before paying.
        </p>
      )}

      <form
        onSubmit={(e) => void pay(e)}
        noValidate
        className="mt-6 grid gap-8 lg:grid-cols-[1fr_24rem]"
      >
        <div className="space-y-6">
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blush-100">
            <h2 className="font-display text-lg font-semibold text-cocoa-800">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="c-name"
                label="Full name"
                error={errors.customerName}
                className="sm:col-span-2"
              >
                <input
                  id="c-name"
                  autoComplete="name"
                  value={form.customerName}
                  onChange={(e) => set('customerName')(e.target.value)}
                  className="field w-full"
                />
              </Field>
              <Field id="c-email" label="Email" error={errors.email}>
                <input
                  id="c-email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set('email')(e.target.value)}
                  className="field w-full"
                />
              </Field>
              <Field id="c-phone" label="Mobile number" error={errors.phone}>
                <input
                  id="c-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={form.phone}
                  onChange={(e) => set('phone')(e.target.value)}
                  className="field w-full"
                />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blush-100">
            <h2 className="font-display text-lg font-semibold text-cocoa-800">Delivery address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field
                id="a-line1"
                label="House / flat, street"
                error={errors.addressLine1}
                className="sm:col-span-2"
              >
                <input
                  id="a-line1"
                  autoComplete="address-line1"
                  value={form.addressLine1}
                  onChange={(e) => set('addressLine1')(e.target.value)}
                  className="field w-full"
                />
              </Field>
              <Field id="a-line2" label="Area, landmark (optional)" className="sm:col-span-2">
                <input
                  id="a-line2"
                  autoComplete="address-line2"
                  value={form.addressLine2}
                  onChange={(e) => set('addressLine2')(e.target.value)}
                  className="field w-full"
                />
              </Field>
              <Field id="a-city" label="City" error={errors.city}>
                <input
                  id="a-city"
                  autoComplete="address-level2"
                  value={form.city}
                  onChange={(e) => set('city')(e.target.value)}
                  className="field w-full"
                />
              </Field>
              <Field id="a-pin" label="PIN code" error={errors.postalCode}>
                <input
                  id="a-pin"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={6}
                  value={form.postalCode}
                  onChange={(e) => set('postalCode')(e.target.value)}
                  className="field w-full"
                />
              </Field>
              <Field id="a-state" label="State" error={errors.state} className="sm:col-span-2">
                <select
                  id="a-state"
                  autoComplete="address-level1"
                  value={form.state}
                  onChange={(e) => set('state')(e.target.value)}
                  className="field w-full pr-8"
                >
                  <option value="">Choose a state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="mt-4 text-xs text-cocoa-400">We currently deliver within India only.</p>
          </section>
        </div>

        <aside className="h-fit rounded-3xl bg-white p-6 shadow-soft ring-1 ring-blush-100 lg:sticky lg:top-6">
          <h2 className="font-display text-xl font-semibold text-cocoa-800">Order summary</h2>
          <ul className="mt-4 divide-y divide-blush-100">
            {cart.items.map((line) => (
              <li
                key={line.variantId}
                className={`flex gap-3 py-3 ${line.issue ? 'opacity-50' : ''}`}
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-blush-100">
                  {line.product.heroImageUrl ? (
                    <img
                      src={line.product.heroImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FlowerIcon className="m-3.5 h-7 w-7 text-blush-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-semibold text-cocoa-800">{line.product.name}</p>
                  <p className="text-xs text-cocoa-400">
                    {line.variant.label !== 'Default' ? `${line.variant.label} · ` : ''}Qty{' '}
                    {line.quantity}
                    {line.product.fulfillmentType === 'MADE_TO_ORDER' ? ' · Made to order' : ''}
                  </p>
                </div>
                <p className="text-sm font-semibold text-cocoa-700">
                  {formatInr(line.lineTotalInPaise)}
                </p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-2 border-t border-blush-100 pt-4 text-sm">
            <div className="flex justify-between text-cocoa-600">
              <dt>Subtotal</dt>
              <dd>{formatInr(cart.subtotalInPaise)}</dd>
            </div>
            <div className="flex justify-between text-cocoa-600">
              <dt>Shipping</dt>
              <dd>{SHIPPING_FEE_IN_PAISE === 0 ? 'Free' : formatInr(SHIPPING_FEE_IN_PAISE)}</dd>
            </div>
            <div className="flex justify-between border-t border-blush-100 pt-3 text-base font-semibold text-cocoa-800">
              <dt>Total payable</dt>
              <dd className="font-display text-2xl text-blush-700">{formatInr(total)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-xs text-cocoa-400">
            Prices include all taxes. Final amount is confirmed by our server.
          </p>

          {message && (
            <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || cart.hasIssues}
            className="btn-primary mt-6 w-full py-3 text-base"
          >
            {status === 'starting'
              ? 'Preparing payment…'
              : status === 'paying'
                ? 'Complete payment in the window…'
                : status === 'verifying'
                  ? 'Confirming payment…'
                  : `Pay ${formatInr(total)}`}
          </button>
          <p className="mt-3 text-center text-xs text-cocoa-400">Secure payment by Razorpay</p>
        </aside>
      </form>
    </div>
  );
}
