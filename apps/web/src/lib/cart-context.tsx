import { MAX_CART_LINE_QUANTITY, MAX_CART_LINES, type CartResponse } from '@susharts/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiFetch } from './api-client.js';
import { useAuth } from './auth-context.js';

interface GuestItem {
  variantId: string;
  quantity: number;
}

interface CartState {
  cart: CartResponse | null;
  loading: boolean;
  error: string | null;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  setQuantity: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const GUEST_KEY = 'susharts.guestCart.v1';
const EMPTY: CartResponse = { items: [], subtotalInPaise: 0, itemCount: 0, hasIssues: false, removedVariantIds: [] };

function readGuest(): GuestItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is GuestItem =>
          typeof i === 'object' &&
          i !== null &&
          typeof (i as GuestItem).variantId === 'string' &&
          Number.isInteger((i as GuestItem).quantity) &&
          (i as GuestItem).quantity > 0,
      )
      .slice(0, MAX_CART_LINES);
  } catch {
    return [];
  }
}

function writeGuest(items: GuestItem[]): void {
  try {
    if (items.length) localStorage.setItem(GUEST_KEY, JSON.stringify(items));
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Storage blocked (private mode); the guest cart just won't survive a reload.
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong';
}

const CartContext = createContext<CartState | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const signedIn = Boolean(user);
  const generation = useRef(0);

  const previewGuest = useCallback(async (items: GuestItem[]): Promise<CartResponse> => {
    if (items.length === 0) return EMPTY;
    const priced = await apiFetch<CartResponse>('/api/v1/cart/preview', {
      method: 'POST',
      body: JSON.stringify({ items }),
    });
    // Drop items that no longer exist so they don't linger in storage forever.
    if (priced.removedVariantIds.length) {
      writeGuest(items.filter((i) => !priced.removedVariantIds.includes(i.variantId)));
    }
    return priced;
  }, []);

  const load = useCallback(async () => {
    const run = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      let next: CartResponse;
      if (signedIn) {
        const guest = readGuest();
        if (guest.length) {
          next = await apiFetch<CartResponse>('/api/v1/cart/merge', {
            method: 'POST',
            body: JSON.stringify({ items: guest }),
          });
          writeGuest([]);
        } else {
          next = await apiFetch<CartResponse>('/api/v1/cart');
        }
      } else {
        next = await previewGuest(readGuest());
      }
      if (run === generation.current) setCart(next);
    } catch (err) {
      if (run === generation.current) setError(errorMessage(err));
    } finally {
      if (run === generation.current) setLoading(false);
    }
  }, [signedIn, previewGuest]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  /** Applies a guest change only if the server confirms the affected line is valid. */
  const changeGuest = useCallback(
    async (next: GuestItem[], checkVariantId?: string) => {
      const priced = await previewGuest(next);
      const line = checkVariantId ? priced.items.find((i) => i.variantId === checkVariantId) : undefined;
      if (checkVariantId && !line) throw new Error('This item is no longer available');
      if (line?.issue === 'UNAVAILABLE') throw new Error('This item is no longer available');
      if (line?.issue === 'INSUFFICIENT_STOCK') {
        throw new Error(line.availableQuantity ? `Only ${line.availableQuantity} left in stock` : 'This item is out of stock');
      }
      writeGuest(next);
      setCart(priced);
    },
    [previewGuest],
  );

  const addItem = useCallback(
    async (variantId: string, quantity: number) => {
      if (signedIn) {
        setCart(
          await apiFetch<CartResponse>('/api/v1/cart/items', {
            method: 'POST',
            body: JSON.stringify({ variantId, quantity }),
          }),
        );
        return;
      }
      const items = readGuest();
      const existing = items.find((i) => i.variantId === variantId);
      if (!existing && items.length >= MAX_CART_LINES) {
        throw new Error(`Your cart can hold at most ${MAX_CART_LINES} different items`);
      }
      const total = (existing?.quantity ?? 0) + quantity;
      if (total > MAX_CART_LINE_QUANTITY) throw new Error(`You can add at most ${MAX_CART_LINE_QUANTITY} of one item`);
      const next = existing
        ? items.map((i) => (i.variantId === variantId ? { ...i, quantity: total } : i))
        : [...items, { variantId, quantity }];
      await changeGuest(next, variantId);
    },
    [signedIn, changeGuest],
  );

  const setQuantity = useCallback(
    async (variantId: string, quantity: number) => {
      if (signedIn) {
        setCart(
          await apiFetch<CartResponse>(`/api/v1/cart/items/${variantId}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          }),
        );
        return;
      }
      await changeGuest(
        readGuest().map((i) => (i.variantId === variantId ? { ...i, quantity } : i)),
        variantId,
      );
    },
    [signedIn, changeGuest],
  );

  const removeItem = useCallback(
    async (variantId: string) => {
      if (signedIn) {
        setCart(await apiFetch<CartResponse>(`/api/v1/cart/items/${variantId}`, { method: 'DELETE' }));
        return;
      }
      await changeGuest(readGuest().filter((i) => i.variantId !== variantId));
    },
    [signedIn, changeGuest],
  );

  const clear = useCallback(async () => {
    if (signedIn) {
      setCart(await apiFetch<CartResponse>('/api/v1/cart', { method: 'DELETE' }));
      return;
    }
    writeGuest([]);
    setCart(EMPTY);
  }, [signedIn]);

  const value = useMemo<CartState>(
    () => ({
      cart,
      loading,
      error,
      itemCount: cart?.itemCount ?? 0,
      refresh: load,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [cart, loading, error, load, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
