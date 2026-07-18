import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { api } from "./api";
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

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartData>(EMPTY);
  const [isOpen, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(EMPTY);
      return;
    }
    try {
      setCart(fixImages(await api<CartData>("/cart/")));
    } catch {
      // keep last known cart on transient failures
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const guard = useCallback(() => {
    if (!isAuthenticated) {
      navigate({ to: "/auth" });
      return false;
    }
    return true;
  }, [isAuthenticated, navigate]);

  const add = useCallback<CartCtx["add"]>(
    async (item, qty = 1) => {
      if (!guard()) return;
      setLoading(true);
      try {
        setCart(
          fixImages(
            await api<CartData>("/cart/items/", {
              method: "POST",
              body: { product_id: item.product_id, variant_id: item.variant_id, quantity: qty },
            }),
          ),
        );
        setOpen(true);
      } finally {
        setLoading(false);
      }
    },
    [guard],
  );

  const setQty = useCallback(async (id: number, qty: number) => {
    setCart(fixImages(await api<CartData>(`/cart/items/${id}/`, { method: "PATCH", body: { quantity: qty } })));
  }, []);

  const remove = useCallback(async (id: number) => {
    setCart(fixImages(await api<CartData>(`/cart/items/${id}/`, { method: "DELETE" })));
  }, []);

  const clear = useCallback(async () => {
    setCart(fixImages(await api<CartData>("/cart/", { method: "DELETE" })));
  }, []);

  const applyCoupon = useCallback(async (code: string) => {
    setCart(fixImages(await api<CartData>("/cart/coupon/", { method: "POST", body: { code } })));
  }, []);

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
