import type { ProductImage } from '@susharts/shared';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CategoryPicker } from '../components/CategoryPicker.js';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import {
  errorText,
  paiseToRupees,
  parseStock,
  rupeesToPaise,
  SLUG_PATTERN,
  slugify,
} from '../lib/admin-utils.js';
import { apiFetch } from '../lib/api-client.js';

type Status = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
type Fulfillment = 'READY_STOCK' | 'MADE_TO_ORDER';

interface AdminVariant {
  id: string;
  label: string;
  sku: string;
  priceInPaise: number;
  compareAtPriceInPaise: number | null;
  stockQuantity: number | null;
  isAvailable: boolean;
}

interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  categoryId: string;
  status: Status;
  fulfillmentType: Fulfillment;
  productionDays: number | null;
  variants: AdminVariant[];
  images: ProductImage[];
}

interface Details {
  name: string;
  slug: string;
  slugEdited: boolean;
  categoryId: string;
  shortDescription: string;
  description: string;
  status: Status;
  fulfillmentType: Fulfillment;
  productionDays: string;
}

interface VariantDraft {
  label: string;
  sku: string;
  price: string;
  compareAt: string;
  stock: string;
  isAvailable: boolean;
}

const EMPTY_DETAILS: Details = {
  name: '',
  slug: '',
  slugEdited: false,
  categoryId: '',
  shortDescription: '',
  description: '',
  status: 'DRAFT',
  fulfillmentType: 'READY_STOCK',
  productionDays: '',
};

const EMPTY_VARIANT: VariantDraft = {
  label: 'Default',
  sku: '',
  price: '',
  compareAt: '',
  stock: '',
  isAvailable: true,
};

function detailsFrom(p: AdminProduct): Details {
  return {
    name: p.name,
    slug: p.slug,
    slugEdited: true,
    categoryId: p.categoryId,
    shortDescription: p.shortDescription ?? '',
    description: p.description ?? '',
    status: p.status,
    fulfillmentType: p.fulfillmentType,
    productionDays: p.productionDays === null ? '' : String(p.productionDays),
  };
}

function variantFrom(v: AdminVariant): VariantDraft {
  return {
    label: v.label,
    sku: v.sku,
    price: paiseToRupees(v.priceInPaise),
    compareAt: paiseToRupees(v.compareAtPriceInPaise),
    stock: v.stockQuantity === null ? '' : String(v.stockQuantity),
    isAvailable: v.isAvailable,
  };
}

function detailsPayload(d: Details): { payload: Record<string, unknown> } | { error: string } {
  if (!d.name.trim()) return { error: 'Product name is required.' };
  if (!SLUG_PATTERN.test(d.slug)) {
    return { error: 'URL slug may only contain lowercase letters, numbers, and single hyphens.' };
  }
  if (!d.categoryId) return { error: 'Choose a category.' };
  let productionDays: number | null = null;
  if (d.fulfillmentType === 'MADE_TO_ORDER' && d.productionDays.trim()) {
    productionDays = Number(d.productionDays);
    if (!Number.isInteger(productionDays) || productionDays < 1 || productionDays > 365) {
      return { error: 'Production time must be a whole number of days (1–365).' };
    }
  }
  return {
    payload: {
      name: d.name.trim(),
      slug: d.slug,
      categoryId: d.categoryId,
      shortDescription: d.shortDescription.trim() || null,
      description: d.description.trim() || null,
      status: d.status,
      fulfillmentType: d.fulfillmentType,
      productionDays,
    },
  };
}

function variantPayload(v: VariantDraft): { payload: Record<string, unknown> } | { error: string } {
  if (!v.label.trim()) return { error: 'Option name is required (use "Default" for a single option).' };
  if (!v.sku.trim()) return { error: 'SKU is required.' };
  const price = rupeesToPaise(v.price);
  if (price === null || Number.isNaN(price) || price <= 0) {
    return { error: 'Price must be a positive amount in rupees, e.g. 249 or 249.50.' };
  }
  const compareAt = rupeesToPaise(v.compareAt);
  if (compareAt !== null && (Number.isNaN(compareAt) || compareAt <= price)) {
    return { error: 'Original price must be higher than the selling price, or left blank.' };
  }
  const stock = parseStock(v.stock);
  if (Number.isNaN(stock)) return { error: 'Stock must be a whole number, or blank for unlimited.' };
  return {
    payload: {
      label: v.label.trim(),
      sku: v.sku.trim(),
      priceInPaise: price,
      compareAtPriceInPaise: compareAt,
      stockQuantity: stock,
      isAvailable: v.isAvailable,
    },
  };
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string | undefined; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-semibold text-cocoa-600">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && <p className="mt-1 text-xs text-cocoa-400">{hint}</p>}
    </div>
  );
}

function Card({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blush-100">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-cocoa-800">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function DetailsFields({ value, onChange }: { value: Details; onChange: (d: Details) => void }) {
  const set = (patch: Partial<Details>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="Product name" htmlFor="p-name">
        <input
          id="p-name"
          value={value.name}
          maxLength={200}
          onChange={(e) =>
            set({ name: e.target.value, ...(value.slugEdited ? {} : { slug: slugify(e.target.value) }) })
          }
          placeholder="e.g. Pink crochet tulip bouquet"
          className="field w-full"
        />
      </Field>
      <Field label="URL slug" htmlFor="p-slug" hint={value.slug ? `/products/${value.slug}` : undefined}>
        <input
          id="p-slug"
          value={value.slug}
          maxLength={200}
          onChange={(e) => set({ slug: e.target.value.toLowerCase(), slugEdited: true })}
          className="field w-full"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Category" htmlFor="p-category">
          <CategoryPicker id="p-category" value={value.categoryId} onChange={(categoryId) => set({ categoryId })} />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Short description" htmlFor="p-short" hint="Shown on product cards. Up to 300 characters.">
          <input
            id="p-short"
            value={value.shortDescription}
            maxLength={300}
            onChange={(e) => set({ shortDescription: e.target.value })}
            className="field w-full"
          />
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="Full description" htmlFor="p-desc">
          <textarea
            id="p-desc"
            rows={5}
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
            className="field w-full rounded-2xl"
          />
        </Field>
      </div>
      <Field label="Visibility" htmlFor="p-status" hint="Only Active products appear in the store.">
        <select
          id="p-status"
          value={value.status}
          onChange={(e) => set({ status: e.target.value as Status })}
          className="field w-full pr-8"
        >
          <option value="DRAFT">Draft (hidden)</option>
          <option value="ACTIVE">Active (visible in store)</option>
          <option value="ARCHIVED">Archived (hidden)</option>
        </select>
      </Field>
      <Field label="Fulfilment" htmlFor="p-fulfil">
        <select
          id="p-fulfil"
          value={value.fulfillmentType}
          onChange={(e) => set({ fulfillmentType: e.target.value as Fulfillment })}
          className="field w-full pr-8"
        >
          <option value="READY_STOCK">Ready stock</option>
          <option value="MADE_TO_ORDER">Made to order</option>
        </select>
      </Field>
      {value.fulfillmentType === 'MADE_TO_ORDER' && (
        <Field label="Production time (days)" htmlFor="p-days" hint="Optional estimate shown to customers.">
          <input
            id="p-days"
            inputMode="numeric"
            value={value.productionDays}
            onChange={(e) => set({ productionDays: e.target.value })}
            className="field w-full"
          />
        </Field>
      )}
    </div>
  );
}

function VariantFields({ value, onChange, prefix }: { value: VariantDraft; onChange: (v: VariantDraft) => void; prefix: string }) {
  const set = (patch: Partial<VariantDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Option name" htmlFor={`${prefix}-label`} hint='e.g. "Small", "Red", or "Default"'>
        <input
          id={`${prefix}-label`}
          value={value.label}
          maxLength={200}
          onChange={(e) => set({ label: e.target.value })}
          className="field w-full"
        />
      </Field>
      <Field label="SKU" htmlFor={`${prefix}-sku`} hint="Your unique stock code.">
        <input
          id={`${prefix}-sku`}
          value={value.sku}
          maxLength={100}
          onChange={(e) => set({ sku: e.target.value.toUpperCase() })}
          placeholder="e.g. TULIP-PINK-01"
          className="field w-full"
        />
      </Field>
      <Field label="Price (₹)" htmlFor={`${prefix}-price`}>
        <input
          id={`${prefix}-price`}
          inputMode="decimal"
          value={value.price}
          onChange={(e) => set({ price: e.target.value })}
          placeholder="249"
          className="field w-full"
        />
      </Field>
      <Field label="Original price (₹)" htmlFor={`${prefix}-compare`} hint="Optional; shown crossed out.">
        <input
          id={`${prefix}-compare`}
          inputMode="decimal"
          value={value.compareAt}
          onChange={(e) => set({ compareAt: e.target.value })}
          className="field w-full"
        />
      </Field>
      <Field label="Stock" htmlFor={`${prefix}-stock`} hint="Leave blank for unlimited (made to order).">
        <input
          id={`${prefix}-stock`}
          inputMode="numeric"
          value={value.stock}
          onChange={(e) => set({ stock: e.target.value })}
          className="field w-full"
        />
      </Field>
      <div className="flex items-center pt-5">
        <label className="inline-flex items-center gap-2 text-sm text-cocoa-700">
          <input
            type="checkbox"
            checked={value.isAvailable}
            onChange={(e) => set({ isAvailable: e.target.checked })}
            className="h-4 w-4 rounded border-blush-300 accent-blush-600"
          />
          Available to buy
        </label>
      </div>
    </div>
  );
}

function VariantRow({ variant, onChanged, onDeleted }: { variant: AdminVariant; onChanged: (v: AdminVariant) => void; onDeleted: (id: string) => void }) {
  const [draft, setDraft] = useState(() => variantFrom(variant));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);

  async function save() {
    const result = variantPayload(draft);
    if ('error' in result) {
      setMessage({ error: true, text: result.error });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const saved = await apiFetch<AdminVariant>(`/api/v1/admin/products/variants/${variant.id}`, {
        method: 'PATCH',
        body: JSON.stringify(result.payload),
      });
      onChanged(saved);
      setMessage({ error: false, text: 'Saved' });
    } catch (err) {
      setMessage({ error: true, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete the "${variant.label}" option?`)) return;
    setBusy(true);
    try {
      await apiFetch<null>(`/api/v1/admin/products/variants/${variant.id}`, { method: 'DELETE' });
      onDeleted(variant.id);
    } catch (err) {
      setMessage({ error: true, text: errorText(err) });
      setBusy(false);
    }
  }

  return (
    <li className="rounded-2xl bg-blush-50/60 p-4 ring-1 ring-blush-100">
      <VariantFields value={draft} onChange={setDraft} prefix={`v-${variant.id}`} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => void save()} className="btn-primary px-4 py-1.5 text-xs">
          Save option
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void remove()}
          className="rounded-full px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
        {message && (
          <span className={`text-xs ${message.error ? 'text-red-700' : 'text-green-700'}`}>{message.text}</span>
        )}
      </div>
    </li>
  );
}

function VariantsEditor({ productId, initial }: { productId: string; initial: AdminVariant[] }) {
  const [variants, setVariants] = useState(initial);
  const [adding, setAdding] = useState(initial.length === 0);
  const [draft, setDraft] = useState<VariantDraft>({ ...EMPTY_VARIANT, label: initial.length ? '' : 'Default' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    const result = variantPayload(draft);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<AdminVariant>(`/api/v1/admin/products/${productId}/variants`, {
        method: 'POST',
        body: JSON.stringify({ ...result.payload, position: variants.length }),
      });
      setVariants((prev) => [...prev, created]);
      setDraft({ ...EMPTY_VARIANT, label: '' });
      setAdding(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title="Price & stock"
      action={
        !adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-secondary px-3 py-1 text-xs">
            + Add option
          </button>
        )
      }
    >
      {variants.length === 0 && (
        <p className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          This product has no price yet, so customers can't buy it. Add at least one option.
        </p>
      )}
      <ul className="space-y-4">
        {variants.map((v) => (
          <VariantRow
            key={v.id}
            variant={v}
            onChanged={(saved) => setVariants((prev) => prev.map((x) => (x.id === saved.id ? saved : x)))}
            onDeleted={(id) => setVariants((prev) => prev.filter((x) => x.id !== id))}
          />
        ))}
      </ul>
      {adding && (
        <div className={`rounded-2xl border border-dashed border-blush-300 p-4 ${variants.length ? 'mt-4' : ''}`}>
          <VariantFields value={draft} onChange={setDraft} prefix="v-new" />
          {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" disabled={busy} onClick={() => void add()} className="btn-primary px-4 py-1.5 text-xs">
              {busy ? 'Adding…' : 'Add option'}
            </button>
            {variants.length > 0 && (
              <button type="button" onClick={() => setAdding(false)} className="btn-secondary px-4 py-1.5 text-xs">
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function CreateProduct() {
  const navigate = useNavigate();
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [variant, setVariant] = useState<VariantDraft>(EMPTY_VARIANT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const d = detailsPayload(details);
    const v = variantPayload(variant);
    if ('error' in d || 'error' in v) {
      setError('error' in d ? d.error : (v as { error: string }).error);
      return;
    }
    setBusy(true);
    setError(null);
    let product: AdminProduct;
    try {
      product = await apiFetch<AdminProduct>('/api/v1/admin/products', {
        method: 'POST',
        body: JSON.stringify(d.payload),
      });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
      return;
    }
    try {
      await apiFetch(`/api/v1/admin/products/${product.id}/variants`, {
        method: 'POST',
        body: JSON.stringify(v.payload),
      });
      navigate(`/admin/products/${product.id}`, { state: { notice: 'Product created. Now add some photos!' } });
    } catch (err) {
      navigate(`/admin/products/${product.id}`, {
        state: { notice: `Product saved, but its price couldn't be added: ${errorText(err)}`, isError: true },
      });
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-6" noValidate>
      <Card title="Details">
        <DetailsFields value={details} onChange={setDetails} />
      </Card>
      <Card title="Price & stock">
        <VariantFields value={variant} onChange={setVariant} prefix="v-first" />
        <p className="mt-4 text-xs text-cocoa-400">You can add more options (sizes, colours) after creating the product.</p>
      </Card>
      {error && (
        <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Creating…' : 'Create product'}
        </button>
        <Link to="/admin" className="btn-secondary">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function EditProduct({ id }: { id: string }) {
  const location = useLocation();
  const initialNotice = (location.state as { notice?: string; isError?: boolean } | null) ?? null;
  const product = useApi<AdminProduct>(`/api/v1/admin/products/${id}`);
  const [details, setDetails] = useState<Details | null>(null);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(
    initialNotice?.notice ? { error: Boolean(initialNotice.isError), text: initialNotice.notice } : null,
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ status: Status; slug: string } | null>(null);

  useEffect(() => {
    if (product.data) setDetails(detailsFrom(product.data));
  }, [product.data]);

  if (product.loading) return <PageSpinner />;
  if (product.error === 'Product not found') {
    return <EmptyState title="Product not found" actionLabel="All products" actionTo="/admin" />;
  }
  if (product.error || !product.data || !details) {
    return <ErrorMessage message={product.error ?? 'Could not load product'} onRetry={product.refetch} />;
  }

  const data = product.data;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!details) return;
    const d = detailsPayload(details);
    if ('error' in d) {
      setMessage({ error: true, text: d.error });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const updated = await apiFetch<AdminProduct>(`/api/v1/admin/products/${data.id}`, {
        method: 'PATCH',
        body: JSON.stringify(d.payload),
      });
      setSaved({ status: updated.status, slug: updated.slug });
      setMessage({ error: false, text: 'Details saved.' });
    } catch (err) {
      setMessage({ error: true, text: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link to={`/admin/products/${data.id}/images`} className="btn-primary">
          Photos ({data.images.length})
        </Link>
        {(saved ?? data).status === 'ACTIVE' && (
          <Link to={`/products/${(saved ?? data).slug}`} className="btn-secondary">
            View in store ↗
          </Link>
        )}
      </div>

      {message && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm ${message.error ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}
        >
          {message.text}
        </p>
      )}

      <form onSubmit={(e) => void save(e)} noValidate>
        <Card title="Details">
          <DetailsFields value={details} onChange={setDetails} />
          <button type="submit" disabled={busy} className="btn-primary mt-6">
            {busy ? 'Saving…' : 'Save details'}
          </button>
        </Card>
      </form>

      <VariantsEditor productId={data.id} initial={data.variants} />
    </div>
  );
}

export function AdminProductFormPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="container-page max-w-4xl py-8">
      <Link to="/admin" className="text-sm text-cocoa-500 hover:text-blush-600">
        ← All products
      </Link>
      <h1 className="mb-6 mt-3 font-display text-3xl font-semibold text-cocoa-800">
        {id ? 'Edit product' : 'New product'}
      </h1>
      {id ? <EditProduct key={id} id={id} /> : <CreateProduct />}
    </div>
  );
}
