import type { CategoryTreeNode } from '@susharts/shared';
import { useState } from 'react';
import { useApi } from '../hooks/use-api.js';
import { errorText, SLUG_PATTERN, slugify } from '../lib/admin-utils.js';
import { apiFetch } from '../lib/api-client.js';

interface CategoryPickerProps {
  id: string;
  value: string;
  onChange: (categoryId: string) => void;
}

export function CategoryPicker({ id, value, onChange }: CategoryPickerProps) {
  const categories = useApi<CategoryTreeNode[]>('/api/v1/categories');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roots = categories.data ?? [];

  async function create() {
    const slug = slugify(name);
    if (!name.trim() || !SLUG_PATTERN.test(slug)) {
      setError('Enter a category name using letters or numbers.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>('/api/v1/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), slug, parentId: parentId || null }),
      });
      categories.refetch();
      onChange(created.id);
      setCreating(false);
      setName('');
      setParentId('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field min-w-0 flex-1 pr-8"
          disabled={categories.loading}
        >
          <option value="">{categories.loading ? 'Loading…' : 'Choose a category'}</option>
          {roots.map((root) => [
            <option key={root.id} value={root.id}>
              {root.name}
            </option>,
            ...root.children.map((child) => (
              <option key={child.id} value={child.id}>
                {`${root.name} › ${child.name}`}
              </option>
            )),
          ])}
        </select>
        <button type="button" onClick={() => setCreating((c) => !c)} className="btn-secondary shrink-0">
          {creating ? 'Cancel' : '+ New'}
        </button>
      </div>

      {categories.error && <p className="mt-2 text-xs text-red-700">{categories.error}</p>}

      {creating && (
        <div className="mt-3 space-y-3 rounded-2xl bg-blush-50 p-4 ring-1 ring-blush-100">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-new-name`} className="block text-xs font-semibold text-cocoa-600">
                Category name
              </label>
              <input
                id={`${id}-new-name`}
                value={name}
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  // This sits inside the product form; Enter should create the category, not submit the product.
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void create();
                  }
                }}
                placeholder="e.g. Keychains"
                className="field mt-1 w-full"
              />
              {name.trim() && <p className="mt-1 text-xs text-cocoa-400">/category/{slugify(name)}</p>}
            </div>
            <div>
              <label htmlFor={`${id}-new-parent`} className="block text-xs font-semibold text-cocoa-600">
                Inside (optional)
              </label>
              <select
                id={`${id}-new-parent`}
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="field mt-1 w-full pr-8"
              >
                <option value="">None — main category</option>
                {roots.map((root) => (
                  <option key={root.id} value={root.id}>
                    {root.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <button type="button" disabled={saving} onClick={() => void create()} className="btn-primary">
            {saving ? 'Creating…' : 'Create category'}
          </button>
        </div>
      )}
    </div>
  );
}
