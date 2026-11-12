import { readAuthToken } from "./auth-token";
import { UnauthenticatedError } from "./api-error";

export { UnauthenticatedError };

const ensureApiBasePath = (value: string): string => {
  const normalized = value.replace(/\/+$/, "");
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
};

const resolveApiBase = (rawApiUrl: string | undefined, isDevMode: boolean): string => {
  if (isDevMode || rawApiUrl === undefined || rawApiUrl === "") {
    return "/api";
  }

  return ensureApiBasePath(rawApiUrl.trim());
};

/** The only read of the build-time origin; every caller imports this constant instead. */
export const API_BASE = resolveApiBase(import.meta.env.VITE_API_URL?.trim(), import.meta.env.DEV);

const AUTHED_PREFIXES = ["/exchange", "/auth/me", "/wallets", "/user"];

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

export function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  const requiresAuth = matchAuthedPrefix(url);
  const headers = new Headers(options?.headers);

  if (requiresAuth) {
    const token = readAuthToken();
    if (token === null || token === "") {
      throw new UnauthenticatedError("Authentication required for this action");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...options, headers });
}
