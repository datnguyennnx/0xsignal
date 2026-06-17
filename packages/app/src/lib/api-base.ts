const ensureApiBasePath = (value: string): string => {
  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
};

export const resolveApiBase = (rawApiUrl: string | undefined, isDevMode: boolean): string => {
  if (isDevMode || !rawApiUrl) {
    return "/api";
  }

  return ensureApiBasePath(rawApiUrl.trim());
};

// Module-level token store with subscription for useSyncExternalStore.

export class UnauthenticatedError extends Error {
  readonly _tag = "UnauthenticatedError";
}

const AUTHED_PREFIXES = ["/exchange", "/auth/me", "/wallets"];

let _inMemoryToken: string | null = null;
const _listeners = new Set<(token: string | null) => void>();

export function setAuthToken(token: string | null): void {
  _inMemoryToken = token;
  _listeners.forEach((fn) => fn(token));
}

export function getToken(): string | null {
  return _inMemoryToken;
}

/**
 * Subscribe to token changes. Returns an unsubscribe function.
 * Designed for use with React's useSyncExternalStore.
 */
export function subscribeToken(listener: (token: string | null) => void): () => void {
  _listeners.add(listener);
  return () => {
    _listeners.delete(listener);
  };
}

/** Checks /exchange and /api/exchange patterns to handle relative dev URLs and absolute production URLs. */
function matchAuthedPrefix(url: string): boolean {
  const path = url.startsWith("http") ? new URL(url).pathname : url;
  return AUTHED_PREFIXES.some((prefix) => {
    const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
    return (
      path.startsWith(normalizedPrefix + "/") ||
      path === normalizedPrefix ||
      path.startsWith(`/api${normalizedPrefix}`) ||
      path.startsWith(`/api${normalizedPrefix}/`)
    );
  });
}

export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const requiresAuth = matchAuthedPrefix(url);
  const headers: HeadersInit = { ...options?.headers };

  if (requiresAuth) {
    const token = getToken();
    if (!token) {
      throw new UnauthenticatedError("Authentication required for this action");
    }
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}
