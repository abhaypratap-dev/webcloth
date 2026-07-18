import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, clearTokens, getAccessToken, setTokens } from "./api";

export type User = {
  id: number;
  full_name: string;
  email: string;
  mobile: string;
  avatar: string | null;
  is_staff: boolean;
  // Hooks for upcoming OTP/email-verification flows; always false until those exist.
  is_email_verified: boolean;
  is_mobile_verified: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    full_name: string;
    email: string;
    mobile: string;
    password: string;
    confirm_password: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      return;
    }
    try {
      setUser(await api<User>("/auth/me/"));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ access: string; refresh: string; user: User }>("/auth/login/", {
      method: "POST",
      body: { email, password },
    });
    setTokens(data.access, data.refresh);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload: Parameters<AuthCtx["register"]>[0]) => {
    const data = await api<{ access: string; refresh: string; user: User }>("/auth/register/", {
      method: "POST",
      body: payload,
    });
    setTokens(data.access, data.refresh);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const refresh = typeof window !== "undefined" ? localStorage.getItem("cutcult:refresh") : null;
    try {
      if (refresh) await api("/auth/logout/", { method: "POST", body: { refresh } });
    } catch {
      // Logout is best-effort; clear local state regardless.
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ user, loading, isAuthenticated: user !== null, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
