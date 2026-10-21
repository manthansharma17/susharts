import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  MAX_IMAGES_PER_PRODUCT,
  type ProductImage,
} from '@susharts/shared';
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { PageSpinner, Spinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { apiFetch, ApiRequestError } from '../lib/api-client.js';

interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  status: string;
  images: ProductImage[];
}

const MAX_MB = MAX_IMAGE_BYTES / 1024 / 1024;

function errorText(err: unknown): string {
  return err instanceof ApiRequestError || err instanceof Error ? err.message : 'Something went wrong';
}

function ImageCard({
  image,
  index,
  count,
  busy,
  onMove,
  onDelete,
  onSaveAlt,
}: {
  image: ProductImage;
  index: number;
  count: number;
  busy: boolean;
  onMove: (from: number, to: number) => void;
  onDelete: (image: ProductImage) => void;
  onSaveAlt: (image: ProductImage, altText: string) => Promise<void>;
}) {
  const [alt, setAlt] = useState(image.altText ?? '');
  const [saving, setSaving] = useState(false);
  const dirty = alt.trim() !== (image.altText ?? '');

  return (
    <li className="overflow-hidden rounded-3xl bg-white p-2 shadow-sm ring-1 ring-blush-100">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-blush-100">
        <img src={image.url} alt={image.altText ?? ''} className="h-full w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-cocoa-700">
          {index === 0 ? 'Main image' : `#${index + 1}`}
        </span>
      </div>
      <form
        className="space-y-2 p-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSaving(true);
          void onSaveAlt(image, alt).finally(() => setSaving(false));
        }}
      >
        <label className="block text-xs font-semibold text-cocoa-600" htmlFor={`alt-${image.id}`}>
          Alt text
        </label>
        <div className="flex gap-2">
          <input
            id={`alt-${image.id}`}
            value={alt}
            maxLength={200}
            onChange={(e) => setAlt(e.target.value)}
            placeholder="Describe the image"
            className="field min-w-0 flex-1 py-1.5 text-xs"
          />
          <button type="submit" disabled={!dirty || saving} className="btn-secondary px-3 py-1 text-xs">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1">
            <button
              type="button"
              disabled={busy || index === 0}
              onClick={() => onMove(index, index - 1)}
              className="btn-secondary px-3 py-1 text-xs"
              aria-label="Move earlier"
            >
              ←
            </button>
            <button
              type="button"
              disabled={busy || index === count - 1}
              onClick={() => onMove(index, index + 1)}
              className="btn-secondary px-3 py-1 text-xs"
              aria-label="Move later"
            >
              →
            </button>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDelete(image)}
            className="rounded-full px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </form>
    </li>
  );
}

export function AdminProductImagesPage() {
  const { id } = useParams<{ id: string }>();
  const product = useApi<AdminProduct>(id ? `/api/v1/admin/products/${id}` : null);

  const [images, setImages] = useState<ProductImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadAlt, setUploadAlt] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (product.data) setImages(product.data.images);
  }, [product.data]);

  if (product.loading) return <PageSpinner />;
  if (product.error === 'Product not found') {
    return (
      <div className="container-page py-8">
        <EmptyState
          title="Product not found"
          description="This product doesn't exist. Pick one from the product list to manage its images."
          actionLabel="All products"
          actionTo="/admin"
        />
      </div>
    );
  }
  if (product.error || !product.data) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={product.error ?? 'Product not found'} onRetry={product.refetch} />
      </div>
    );
  }

  const productId = product.data.id;
  const remaining = MAX_IMAGES_PER_PRODUCT - images.length;

  async function handleUpload(files: FileList) {
    setActionError(null);
    const selected = Array.from(files);
    if (selected.length > remaining) {
      setActionError(`You can add ${remaining} more image${remaining === 1 ? '' : 's'} to this product.`);
      return;
    }
    const invalid = selected.find(
      (f) => !(ALLOWED_IMAGE_TYPES as readonly string[]).includes(f.type) || f.size > MAX_IMAGE_BYTES,
    );
    if (invalid) {
      setActionError(`"${invalid.name}" must be a JPEG, PNG, or WebP image of ${MAX_MB} MB or less.`);
      return;
    }

    setBusy(true);
    try {
      for (const [i, file] of selected.entries()) {
        setStatus(`Uploading ${i + 1} of ${selected.length}…`);
        const body = new FormData();
        body.append('image', file);
        if (uploadAlt.trim()) body.append('altText', uploadAlt.trim());
        const created = await apiFetch<ProductImage>(`/api/v1/admin/products/${productId}/images`, {
          method: 'POST',
          body,
        });
        setImages((prev) => [...prev, created]);
      }
      setUploadAlt('');
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
      setStatus(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function handleMove(from: number, to: number) {
    const previous = images;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setImages(next);
    setBusy(true);
    setActionError(null);
    try {
      const saved = await apiFetch<ProductImage[]>(`/api/v1/admin/products/${productId}/images/order`, {
        method: 'PUT',
        body: JSON.stringify({ imageIds: next.map((img) => img.id) }),
      });
      setImages(saved);
    } catch (err) {
      setImages(previous);
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(image: ProductImage) {
    if (!window.confirm('Delete this image? This cannot be undone.')) return;
    setBusy(true);
    setActionError(null);
    try {
      await apiFetch<null>(`/api/v1/admin/products/images/${image.id}`, { method: 'DELETE' });
      setImages((prev) =>
        prev.filter((img) => img.id !== image.id).map((img, position) => ({ ...img, position })),
      );
    } catch (err) {
      setActionError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveAlt(image: ProductImage, altText: string) {
    setActionError(null);
    try {
      const updated = await apiFetch<ProductImage>(`/api/v1/admin/products/images/${image.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ altText }),
      });
      setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
    } catch (err) {
      setActionError(errorText(err));
    }
  }

  return (
    <div className="container-page py-8">
      <Link to="/admin" className="text-sm text-cocoa-500 hover:text-blush-600">
        ← All products
      </Link>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-800">Product images</h1>
          <p className="mt-1 text-sm text-cocoa-500">
            {product.data.name} · {images.length} of {MAX_IMAGES_PER_PRODUCT} images · the first image is
            shown on product cards.
          </p>
        </div>
        <Link to={`/admin/products/${productId}`} className="btn-secondary">
          Edit details
        </Link>
        {product.data.status === 'ACTIVE' && (
          <Link to={`/products/${product.data.slug}`} className="btn-secondary">
            View product
          </Link>
        )}
      </div>

      <section className="mt-6 rounded-3xl border border-dashed border-blush-300 bg-white/70 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="upload-alt" className="block text-xs font-semibold text-cocoa-600">
              Alt text for new uploads (optional)
            </label>
            <input
              id="upload-alt"
              value={uploadAlt}
              maxLength={200}
              onChange={(e) => setUploadAlt(e.target.value)}
              placeholder="e.g. Pink crochet bunny keychain"
              className="field mt-1 w-full"
            />
          </div>
          <label className={`btn-primary cursor-pointer ${busy || remaining <= 0 ? 'pointer-events-none opacity-60' : ''}`}>
            {busy && status ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : null}
            {status ?? 'Choose images'}
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              multiple
              disabled={busy || remaining <= 0}
              className="sr-only"
              onChange={(e) => {
                if (e.target.files?.length) void handleUpload(e.target.files);
              }}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-cocoa-400">
          JPEG, PNG, or WebP · up to {MAX_MB} MB each
          {remaining <= 0 ? ' · image limit reached' : ''}
        </p>
      </section>

      {actionError && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {images.length === 0 ? (
        <p className="mt-10 text-center text-sm text-cocoa-400">No images yet. Upload the first one above.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {images.map((image, index) => (
            <ImageCard
              key={image.id}
              image={image}
              index={index}
              count={images.length}
              busy={busy}
              onMove={(from, to) => void handleMove(from, to)}
              onDelete={(img) => void handleDelete(img)}
              onSaveAlt={handleSaveAlt}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
