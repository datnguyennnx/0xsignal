/**
 * @overview Backend API Base Resolver
 *
 * Resolves the frontend HTTP/WS base path for backend market-data endpoints.
 * In dev it uses the local `/api` proxy; in configured environments it normalizes
 * absolute API URLs so frontend transport stays backend-routed.
 */
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
