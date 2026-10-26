import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, ApiError, clearTokens, getAccessToken, getRefreshToken, setTokens } from "./api";

export type User = {
  id: number;
  full_name: string;
  /** Null for customers who signed in by mobile code and never gave one. */
  email: string | null;
  mobile: string;
  avatar: string | null;
  is_staff: boolean;
  is_email_verified: boolean;
  is_mobile_verified: boolean;
};

type Session = { access: string; refresh: string; user: User };

/** What the API says after sending a sign-in code. */
export type CodeSent = {
  kind: "email" | "mobile";
  /** Canonical form: lower-cased email or +91XXXXXXXXXX. Send it back to verify. */
  identifier: string;
  /** Where it went: "email", "whatsapp", or both. Empty while a recent code is still live. */
  channels: string[];
  retry_after: number;
  is_new: boolean;
  detail: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** Email or mobile + password. Kept for staff; customers sign in by code. */
  login: (email: string, password: string) => Promise<User>;
  /** Send a 6-digit sign-in code to an email address or mobile number. */
  requestCode: (identifier: string) => Promise<CodeSent>;
  /** Exchange the code for a session; creates the account the first time. */
  verifyCode: (identifier: string, code: string) => Promise<User>;
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

  const startSession = useCallback((data: Session) => {
    setTokens(data.access, data.refresh);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        return startSession(
          await api<Session>("/auth/login/", { method: "POST", body: { email, password } }),
        );
      } catch (error) {
        if (error instanceof ApiError && error.errors?.code === "email_not_verified") {
          // A customer account on the password form; the code form needs no password.
          throw new Error("Sign in with a one-time code instead — we'll send it to your email.");
        }
        throw error;
      }
    },
    [startSession],
  );

  const requestCode = useCallback(
    (identifier: string) =>
      api<CodeSent>("/auth/otp/request/", { method: "POST", body: { identifier } }),
    [],
  );

  const verifyCode = useCallback(
    async (identifier: string, code: string) =>
      startSession(
        await api<Session>("/auth/otp/verify/", { method: "POST", body: { identifier, code } }),
      ),
    [startSession],
  );

  const logout = useCallback(async () => {
    // Via the client, not a literal key: storage is namespaced per brand.
    const refresh = getRefreshToken();
    try {
      if (refresh) await api("/auth/logout/", { method: "POST", body: { refresh } });
    } catch {
      // Logout is best-effort; clear local state regardless.
    }
    clearTokens();
    setUser(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,
      isAuthenticated: user !== null,
      login,
      requestCode,
      verifyCode,
      logout,
      refreshUser,
    }),
    [user, loading, login, requestCode, verifyCode, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
