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
  email: string;
  mobile: string;
  avatar: string | null;
  is_staff: boolean;
  is_email_verified: boolean;
  is_mobile_verified: boolean;
};

type Session = { access: string; refresh: string; user: User };

/**
 * Thrown by login and register when the account exists but the email address
 * still has to be confirmed. The API has already emailed a 6-digit code;
 * finish with `verifyEmail`.
 */
export class VerificationRequired extends Error {
  email: string;
  retryAfter: number;

  constructor(email: string, detail: string, retryAfter: number) {
    super(detail);
    this.email = email;
    this.retryAfter = retryAfter;
  }
}

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
  verifyEmail: (email: string, code: string) => Promise<User>;
  resendCode: (email: string) => Promise<{ detail: string; retry_after: number }>;
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
        const errors = error instanceof ApiError ? error.errors : undefined;
        if (error instanceof ApiError && errors?.code === "email_not_verified") {
          throw new VerificationRequired(
            String(errors.email ?? email),
            error.message,
            Number(errors.retry_after ?? 0),
          );
        }
        throw error;
      }
    },
    [startSession],
  );

  const register = useCallback(
    async (payload: Parameters<AuthCtx["register"]>[0]) => {
      const data = await api<
        | Session
        | { verification_required: true; email: string; detail: string; retry_after: number }
      >("/auth/register/", { method: "POST", body: payload });
      if ("verification_required" in data) {
        throw new VerificationRequired(data.email, data.detail, data.retry_after);
      }
      return startSession(data);
    },
    [startSession],
  );

  const verifyEmail = useCallback(
    async (email: string, code: string) =>
      startSession(
        await api<Session>("/auth/verify-email/", { method: "POST", body: { email, code } }),
      ),
    [startSession],
  );

  const resendCode = useCallback(
    (email: string) =>
      api<{ detail: string; retry_after: number }>("/auth/resend-verification/", {
        method: "POST",
        body: { email },
      }),
    [],
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
      register,
      verifyEmail,
      resendCode,
      logout,
      refreshUser,
    }),
    [user, loading, login, register, verifyEmail, resendCode, logout, refreshUser],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
