import type { AdminCategory, AdminCategoryNode } from '@susharts/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { PageSpinner } from '../components/Spinner.js';
import { useApi } from '../hooks/use-api.js';
import { errorText, SLUG_PATTERN, slugify } from '../lib/admin-utils.js';
import { apiFetch } from '../lib/api-client.js';

interface FormValues {
  name: string;
  slug: string;
  slugEdited: boolean;
  description: string;
  parentId: string;
}

function validate(v: FormValues): string | null {
  if (!v.name.trim()) return 'Name is required.';
  if (!SLUG_PATTERN.test(v.slug)) return 'Slug may only contain lowercase letters, numbers, and single hyphens.';
  return null;
}

function CategoryFields({
  value,
  onChange,
  parents,
  prefix,
  parentLocked,
}: {
  value: FormValues;
  onChange: (v: FormValues) => void;
  parents: AdminCategory[];
  prefix: string;
  parentLocked?: string | undefined;
}) {
  const set = (patch: Partial<FormValues>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label htmlFor={`${prefix}-name`} className="block text-xs font-semibold text-cocoa-600">
          Name
        </label>
        <input
          id={`${prefix}-name`}
          value={value.name}
          maxLength={100}
          onChange={(e) =>
            set({ name: e.target.value, ...(value.slugEdited ? {} : { slug: slugify(e.target.value) }) })
          }
          className="field mt-1 w-full"
        />
      </div>
      <div>
        <label htmlFor={`${prefix}-slug`} className="block text-xs font-semibold text-cocoa-600">
          URL slug
        </label>
        <input
          id={`${prefix}-slug`}
          value={value.slug}
          maxLength={100}
          onChange={(e) => set({ slug: e.target.value.toLowerCase(), slugEdited: true })}
          className="field mt-1 w-full"
        />
        {value.slug && <p className="mt-1 text-xs text-cocoa-400">/category/{value.slug}</p>}
      </div>
      <div>
        <label htmlFor={`${prefix}-parent`} className="block text-xs font-semibold text-cocoa-600">
          Inside
        </label>
        <select
          id={`${prefix}-parent`}
          value={value.parentId}
          disabled={Boolean(parentLocked)}
          onChange={(e) => set({ parentId: e.target.value })}
          className="field mt-1 w-full"
        >
          <option value="">None — main category</option>
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.isArchived ? ' (archived)' : ''}
            </option>
          ))}
        </select>
        {parentLocked && <p className="mt-1 text-xs text-cocoa-400">{parentLocked}</p>}
      </div>
      <div>
        <label htmlFor={`${prefix}-desc`} className="block text-xs font-semibold text-cocoa-600">
          Description (optional)
        </label>
        <input
          id={`${prefix}-desc`}
          value={value.description}
          maxLength={500}
          onChange={(e) => set({ description: e.target.value })}
          className="field mt-1 w-full"
        />
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  index,
  siblings,
  parents,
  childCount,
  busy,
  onMove,
  onChanged,
}: {
  category: AdminCategory;
  index: number;
  siblings: number;
  parents: AdminCategory[];
  childCount: number;
  busy: boolean;
  onMove: (from: number, to: number) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<FormValues | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValues({
      name: category.name,
      slug: category.slug,
      slugEdited: true,
      description: category.description ?? '',
      parentId: category.parentId ?? '',
    });
    setError(null);
    setEditing(true);
  }

  async function run(action: () => Promise<unknown>) {
    setWorking(true);
    setError(null);
    try {
      await action();
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setWorking(false);
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    if (!values) return;
    const problem = validate(values);
    if (problem) {
      setError(problem);
      return;
    }
    void run(() =>
      apiFetch(`/api/v1/admin/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: values.name.trim(),
          slug: values.slug,
          description: values.description.trim() || null,
          parentId: values.parentId || null,
        }),
      }),
    );
  }

  const toggleArchive = () =>
    void run(() =>
      apiFetch(`/api/v1/admin/categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: !category.isArchived }),
      }),
    );

  const remove = () => {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) return;
    void run(() => apiFetch(`/api/v1/admin/categories/${category.id}`, { method: 'DELETE' }));
  };

  const disabled = busy || working;
  const otherParents = parents.filter((p) => p.id !== category.id);

  return (
    <div className={`rounded-2xl p-3 ${category.isArchived ? 'bg-blush-50/60 opacity-75' : 'bg-white'}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={disabled || index === 0}
            onClick={() => onMove(index, index - 1)}
            className="btn-secondary h-7 w-7 p-0 text-xs"
            aria-label={`Move ${category.name} up`}
          >
            ↑
          </button>
          <button
            type="button"
            disabled={disabled || index === siblings - 1}
            onClick={() => onMove(index, index + 1)}
            className="btn-secondary h-7 w-7 p-0 text-xs"
            aria-label={`Move ${category.name} down`}
          >
            ↓
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-cocoa-800">
            {category.name}
            {category.isArchived && (
              <span className="rounded-full bg-blush-100 px-2 py-0.5 text-xs font-semibold text-cocoa-500">
                Archived
              </span>
            )}
          </p>
          <p className="text-xs text-cocoa-400">
            /category/{category.slug} · {category.productCount} product{category.productCount === 1 ? '' : 's'}
            {childCount > 0 ? ` · ${childCount} sub-categor${childCount === 1 ? 'y' : 'ies'}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {!category.isArchived && (
            <Link to={`/category/${category.slug}`} className="btn-secondary px-3 py-1 text-xs">
              View
            </Link>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => (editing ? setEditing(false) : startEdit())}
            className="btn-secondary px-3 py-1 text-xs"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
          <button type="button" disabled={disabled} onClick={toggleArchive} className="btn-secondary px-3 py-1 text-xs">
            {category.isArchived ? 'Restore' : 'Archive'}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={remove}
            className="rounded-full px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && values && (
        <form onSubmit={save} className="mt-3 rounded-2xl bg-blush-50 p-4 ring-1 ring-blush-100" noValidate>
          <CategoryFields
            value={values}
            onChange={setValues}
            parents={otherParents}
            prefix={`edit-${category.id}`}
            parentLocked={childCount > 0 ? 'Has sub-categories, so it must stay a main category.' : undefined}
          />
          <button type="submit" disabled={working} className="btn-primary mt-4 px-4 py-1.5 text-xs">
            {working ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}

const EMPTY: FormValues = { name: '', slug: '', slugEdited: false, description: '', parentId: '' };

export function AdminCategoriesPage() {
  const categories = useApi<AdminCategoryNode[]>('/api/v1/admin/categories');
  const [creating, setCreating] = useState(false);
  const [values, setValues] = useState<FormValues>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (categories.loading && !categories.data) return <PageSpinner />;
  if (categories.error && !categories.data) {
    return (
      <div className="container-page py-8">
        <ErrorMessage message={categories.error} onRetry={categories.refetch} />
      </div>
    );
  }

  const roots = categories.data ?? [];

  async function create(e: FormEvent) {
    e.preventDefault();
    const problem = validate(values);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/v1/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name.trim(),
          slug: values.slug,
          description: values.description.trim() || null,
          parentId: values.parentId || null,
        }),
      });
      setValues(EMPTY);
      setCreating(false);
      categories.refetch();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function move(level: AdminCategory[], parentId: string | null, from: number, to: number) {
    const ids = level.map((c) => c.id);
    const [moved] = ids.splice(from, 1);
    if (!moved) return;
    ids.splice(to, 0, moved);
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/v1/admin/categories/order', {
        method: 'PUT',
        body: JSON.stringify({ parentId, categoryIds: ids }),
      });
      categories.refetch();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page max-w-4xl py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-cocoa-800">Categories</h1>
          <p className="mt-1 text-sm text-cocoa-500">
            Order here is the order shown in the store menu. Archived categories are hidden from customers.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => setCreating(true)} className="btn-primary">
            + New category
          </button>
        )}
      </div>

      {creating && (
        <form onSubmit={(e) => void create(e)} className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-blush-100" noValidate>
          <h2 className="mb-4 font-display text-lg font-semibold text-cocoa-800">New category</h2>
          <CategoryFields value={values} onChange={setValues} parents={roots} prefix="new" />
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Creating…' : 'Create category'}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setValues(EMPTY);
                setError(null);
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {roots.length === 0 ? (
        <p className="mt-10 text-center text-sm text-cocoa-400">No categories yet. Create your first one above.</p>
      ) : (
        <ul className="mt-6 space-y-4">
          {roots.map((root, i) => (
            <li key={root.id} className="rounded-3xl bg-white p-3 shadow-sm ring-1 ring-blush-100">
              <CategoryRow
                category={root}
                index={i}
                siblings={roots.length}
                parents={roots}
                childCount={root.children.length}
                busy={busy}
                onMove={(from, to) => void move(roots, null, from, to)}
                onChanged={categories.refetch}
              />
              {root.children.length > 0 && (
                <ul className="ml-6 mt-2 space-y-2 border-l-2 border-blush-100 pl-4">
                  {root.children.map((child, j) => (
                    <li key={child.id}>
                      <CategoryRow
                        category={child}
                        index={j}
                        siblings={root.children.length}
                        parents={roots}
                        childCount={0}
                        busy={busy}
                        onMove={(from, to) => void move(root.children, root.id, from, to)}
                        onChanged={categories.refetch}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
