import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";

import { api } from "./api";
import { useAuth } from "./auth";

type WishlistCtx = {
  ids: Set<number>;
  has: (productId: number) => boolean;
  toggle: (productId: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<WishlistCtx | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [ids, setIds] = useState<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setIds(new Set());
      return;
    }
    try {
      setIds(new Set(await api<number[]>("/wishlist/ids/")));
    } catch {
      // transient failure — keep current state
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    async (productId: number) => {
      if (!isAuthenticated) {
        navigate({ to: "/auth" });
        return;
      }
      const res = await api<{ in_wishlist: boolean }>("/wishlist/toggle/", {
        method: "POST",
        body: { product_id: productId },
      });
      setIds((prev) => {
        const next = new Set(prev);
        if (res.in_wishlist) next.add(productId);
        else next.delete(productId);
        return next;
      });
    },
    [isAuthenticated, navigate],
  );

  const value = useMemo<WishlistCtx>(
    () => ({ ids, has: (id) => ids.has(id), toggle, refresh }),
    [ids, toggle, refresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWishlist() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useWishlist must be used within WishlistProvider");
  return c;
}
