/**
 * REST API client for the Django backend.
 * Handles JWT storage, automatic access-token refresh, and JSON errors.
 */

export const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8001/api";

const ACCESS_KEY = "cutcult:access";
const REFRESH_KEY = "cutcult:refresh";

const isBrowser = typeof window !== "undefined";

export function getAccessToken(): string | null {
  return isBrowser ? localStorage.getItem(ACCESS_KEY) : null;
}

export function getRefreshToken(): string | null {
  return isBrowser ? localStorage.getItem(REFRESH_KEY) : null;
}

export function setTokens(access: string, refresh?: string) {
  if (!isBrowser) return;
  localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  if (!isBrowser) return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  errors?: Record<string, unknown>;

  constructor(status: number, detail: string, errors?: Record<string, unknown>) {
    super(detail);
    this.status = status;
    this.errors = errors;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const data = await res.json();
      setTokens(data.access, data.refresh);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

export async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const doFetch = async () => {
    const headers = new Headers(options.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    let body: BodyInit | undefined;
    if (options.body !== undefined) {
      if (options.body instanceof FormData) {
        body = options.body;
      } else {
        headers.set("Content-Type", "application/json");
        body = JSON.stringify(options.body);
      }
    }
    return fetch(`${API_URL}${path}`, { ...options, headers, body });
  };

  let res = await doFetch();
  if (res.status === 401 && getRefreshToken()) {
    if (await tryRefresh()) res = await doFetch();
  }

  if (res.status === 204 || res.status === 205) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : await res.text();

  if (!res.ok) {
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, detail, typeof data === "object" ? (data as any).errors : undefined);
  }
  return data as T;
}

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

/** Builds a query string, skipping null/undefined/empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}
