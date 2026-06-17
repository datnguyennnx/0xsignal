import type { ApiErrorBody, ApiEnvelope } from "@0xsignal/shared";
import { resolveApiBase, apiFetch, UnauthenticatedError } from "@/lib/api-base";
import { useAuthStore } from "@/stores/use-auth-store";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
export const API_BASE = resolveApiBase(configuredApiUrl, import.meta.env.DEV);

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly statusText?: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export function toNumberOrNull(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function extractRawCandlePayload(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.candles)) return obj.candles as Record<string, unknown>[];
    if (Array.isArray(obj.lane)) return obj.lane as Record<string, unknown>[];
    if (Array.isArray(obj.data)) return obj.data as Record<string, unknown>[];
  }
  return [];
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body;
  } catch {
    return null;
  }
}

function unwrapEnvelope<T>(json: unknown): T {
  if (json && typeof json === "object" && "data" in json) {
    return (json as ApiEnvelope<T>).data;
  }
  return json as T;
}

/** Token refresh dedup: single in-flight request with auto-reset. */
const refreshManager = {
  _activePromise: null as Promise<boolean> | null,

  async attempt(): Promise<boolean> {
    if (this._activePromise) {
      return this._activePromise;
    }

    this._activePromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const body = await res.json();
          const data =
            body && typeof body === "object" && "data" in body
              ? (body as { data?: { accessToken: string } }).data
              : body;
          if (data && data.accessToken) {
            useAuthStore.getState().setToken(data.accessToken);
            return true;
          }
        }
        return false;
      } catch {
        return false;
      } finally {
        this._activePromise = null;
      }
    })();

    return this._activePromise;
  },
};

async function attemptSilentRefresh(): Promise<boolean> {
  return refreshManager.attempt();
}

export async function fetchJson<T>(
  url: string,
  options?: RequestInit,
  isRetry = false,
): Promise<T> {
  try {
    const response = await apiFetch(url, {
      credentials: "include",
      ...options,
    });

    if (!response.ok) {
      if (response.status === 401 && !isRetry) {
        const refreshed = await attemptSilentRefresh();
        if (refreshed) {
          return fetchJson<T>(url, options, true);
        } else {
          useAuthStore.getState().setToken(null);
        }
      }

      const errorBody = await parseErrorBody(response);
      throw new ApiError(
        errorBody?.error ?? `API request failed: ${response.statusText}`,
        response.status,
        response.statusText,
        errorBody?.code,
      );
    }

    const body = await response.json();
    return unwrapEnvelope<T>(body);
  } catch (error) {
    if (error instanceof ApiError || error instanceof UnauthenticatedError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : "Network request failed");
  }
}
