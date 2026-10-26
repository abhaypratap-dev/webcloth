import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, TENANT_SLUG } from "./api";
import { resolveAsset } from "./assets";
import { useAuth } from "./auth";

export type CartItem = {
  id: number;
  product_id: number;
  variant_id: number | null;
  slug: string;
  title: string;
  price: number;
  base_price: number;
  size: string | null;
  color: string | null;
  image: string;
  quantity: number;
  stock: number;
};

export type CartData = {
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  coupon_code: string | null;
  coupon_error: string | null;
};

const EMPTY: CartData = {
  items: [],
  subtotal: 0,
  discount: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  coupon_code: null,
  coupon_error: null,
};

type CartCtx = CartData & {
  isOpen: boolean;
  count: number;
  loading: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (item: { product_id: number; variant_id: number | null }, qty?: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setQty: (id: number, qty: number) => Promise<void>;
  clear: () => Promise<void>;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<CartCtx | null>(null);

function fixImages(cart: CartData): CartData {
  return { ...cart, items: cart.items.map((i) => ({ ...i, image: resolveAsset(i.image) })) };
}

/**
 * A visitor's bag before they sign in: just what was picked, in this
 * browser. The API prices it (/cart/preview/) so offers and stock are always
 * current, and folds it into their account cart on sign-in (/cart/merge/).
 */
type GuestLine = { product_id: number; variant_id: number | null; quantity: number };

// Namespaced like the tokens, so two storefronts on one origin keep separate bags.
const GUEST_KEY = `${TENANT_SLUG}:bag`;

function readGuest(): GuestLine[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(GUEST_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGuest(lines: GuestLine[]) {
  try {
    if (lines.length) localStorage.setItem(GUEST_KEY, JSON.stringify(lines));
    else localStorage.removeItem(GUEST_KEY);
  } catch {
    // Private mode or blocked storage: the bag lasts for this page only.
  }
}

const sameLine = (a: { product_id: number; variant_id: number | null }, b: typeof a) =>
  a.product_id === b.product_id && (a.variant_id ?? null) === (b.variant_id ?? null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<CartData>(EMPTY);
  const [isOpen, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const priceGuest = useCallback(async (lines: GuestLine[]) => {
    writeGuest(lines);
    if (!lines.length) {
      setCart(EMPTY);
      return;
    }
    const priced = fixImages(
      await api<CartData>("/cart/preview/", { method: "POST", body: { items: lines } }),
    );
    // Sold-out or withdrawn lines come back dropped; forget them here too.
    writeGuest(
      priced.items.map((i) => ({ product_id: i.product_id, variant_id: i.variant_id, quantity: i.quantity })),
    );
    setCart(priced);
  }, []);

  const refresh = useCallback(async () => {
    if (authLoading) return;
    try {
      if (!isAuthenticated) {
        await priceGuest(readGuest());
        return;
      }
      const guest = readGuest();
      if (guest.length) {
        // Just signed in with a bag in hand: it joins the account's cart.
        setCart(fixImages(await api<CartData>("/cart/merge/", { method: "POST", body: { items: guest } })));
        writeGuest([]);
        return;
      }
      setCart(fixImages(await api<CartData>("/cart/")));
    } catch {
      // keep last known cart on transient failures
    }
  }, [isAuthenticated, authLoading, priceGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Guest lines carry the id the preview gave them; map it back to the product.
  const guestLine = useCallback(
    (id: number) => {
      const item = cart.items.find((i) => i.id === id);
      return item ? { product_id: item.product_id, variant_id: item.variant_id } : null;
    },
    [cart.items],
  );

  const add = useCallback<CartCtx["add"]>(
    async (item, qty = 1) => {
      setLoading(true);
      try {
        if (!isAuthenticated) {
          const lines = readGuest();
          const existing = lines.find((l) => sameLine(l, item));
          if (existing) existing.quantity = Math.min(existing.quantity + qty, 20);
          else lines.push({ product_id: item.product_id, variant_id: item.variant_id, quantity: qty });
          await priceGuest(lines);
        } else {
          setCart(
            fixImages(
              await api<CartData>("/cart/items/", {
                method: "POST",
                body: { product_id: item.product_id, variant_id: item.variant_id, quantity: qty },
              }),
            ),
          );
        }
        setOpen(true);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, priceGuest],
  );

  const setQty = useCallback(
    async (id: number, qty: number) => {
      if (!isAuthenticated) {
        const target = guestLine(id);
        if (!target) return;
        const stock = cart.items.find((i) => i.id === id)?.stock ?? 20;
        const lines = readGuest()
          .map((l) => (sameLine(l, target) ? { ...l, quantity: Math.min(qty, stock, 20) } : l))
          .filter((l) => l.quantity > 0);
        await priceGuest(lines);
        return;
      }
      setCart(fixImages(await api<CartData>(`/cart/items/${id}/`, { method: "PATCH", body: { quantity: qty } })));
    },
    [isAuthenticated, guestLine, cart.items, priceGuest],
  );

  const remove = useCallback(
    async (id: number) => {
      if (!isAuthenticated) {
        const target = guestLine(id);
        if (target) await priceGuest(readGuest().filter((l) => !sameLine(l, target)));
        return;
      }
      setCart(fixImages(await api<CartData>(`/cart/items/${id}/`, { method: "DELETE" })));
    },
    [isAuthenticated, guestLine, priceGuest],
  );

  const clear = useCallback(async () => {
    if (!isAuthenticated) {
      await priceGuest([]);
      return;
    }
    setCart(fixImages(await api<CartData>("/cart/", { method: "DELETE" })));
  }, [isAuthenticated, priceGuest]);

  const applyCoupon = useCallback(
    async (code: string) => {
      if (!isAuthenticated) throw new Error("Sign in to use a coupon.");
      setCart(fixImages(await api<CartData>("/cart/coupon/", { method: "POST", body: { code } })));
    },
    [isAuthenticated],
  );

  const removeCoupon = useCallback(async () => {
    setCart(fixImages(await api<CartData>("/cart/coupon/", { method: "DELETE" })));
  }, []);

  const value = useMemo<CartCtx>(
    () => ({
      ...cart,
      isOpen,
      loading,
      count: cart.items.reduce((n, i) => n + i.quantity, 0),
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
      add,
      remove,
      setQty,
      clear,
      applyCoupon,
      removeCoupon,
      refresh,
    }),
    [cart, isOpen, loading, add, remove, setQty, clear, applyCoupon, removeCoupon, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used within CartProvider");
  return c;
}
