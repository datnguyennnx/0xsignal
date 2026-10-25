import type { ApiErrorBody } from "@0xsignal/shared";
import { readAuthToken, writeAuthToken } from "@/lib/auth-token";
import { ApiError } from "@/lib/api-error";
import { resolveApiBase, apiFetch, UnauthenticatedError } from "@/lib/api-base";

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
export const API_BASE = resolveApiBase(configuredApiUrl, import.meta.env.DEV);

class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toNumberOrNull(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * JSON boundary. The payload shape is owned by the backend contract, so the parsed
 * body is handed back as the type the caller declared, with the `{ data }` envelope
 * unwrapped when present.
 */
function readPayload<T>(response: Response): Promise<T>;
function readPayload(response: Response): Promise<unknown>;
async function readPayload(response: Response): Promise<unknown> {
  const body: unknown = await response.json();
  return isRecord(body) && "data" in body ? body.data : body;
}

async function parseErrorBody(response: Response): Promise<ApiErrorBody | null> {
  try {
    const body = await readPayload(response);
    if (!isRecord(body) || typeof body.error !== "string") return null;
    return typeof body.code === "string"
      ? { error: body.error, code: body.code }
      : { error: body.error };
  } catch {
    return null;
  }
}

const REFRESH_ENDPOINT = "/auth/refresh";

function isRefreshEndpoint(url: string): boolean {
  const path = url.startsWith("http") ? new URL(url).pathname : url.split("?")[0];
  return path === REFRESH_ENDPOINT || path.endsWith(REFRESH_ENDPOINT);
}

interface SilentRefreshDecision {
  readonly url: string;
  readonly status: number;
  readonly isRetry: boolean;
  readonly authToken: string | null;
}

/**
 * A silent refresh is only meaningful for a non-refresh request that had a token and
 * has not already been replayed. Without a token there is no session hint to recover.
 */
export function shouldAttemptSilentRefresh({
  url,
  status,
  isRetry,
  authToken,
}: SilentRefreshDecision): boolean {
  if (status !== 401 || isRetry) return false;
  if (isRefreshEndpoint(url)) return false;
  return authToken !== null && authToken !== "";
}

/**
 * Token refresh dedup: one in-flight request. A failure is latched against the token
 * it was attempted with, so later 401s cannot retry it once per request; a new login
 * token clears the latch by simply differing.
 */
const refreshManager = {
  activePromise: null as Promise<boolean> | null,
  failedForToken: null as string | null,

  attempt(): Promise<boolean> {
    const currentToken = readAuthToken();
    if (currentToken === null || currentToken === "") return Promise.resolve(false);
    if (this.failedForToken === currentToken) return Promise.resolve(false);
    if (this.activePromise !== null) {
      return this.activePromise;
    }

    this.activePromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const body = await readPayload(res);
          const data = isRecord(body) && "data" in body ? body.data : body;
          const nextToken = isRecord(data) ? data.accessToken : undefined;
          if (typeof nextToken === "string" && nextToken !== "") {
            writeAuthToken(nextToken);
            this.failedForToken = null;
            return true;
          }
        }
        this.failedForToken = currentToken;
        return false;
      } catch {
        this.failedForToken = currentToken;
        return false;
      } finally {
        this.activePromise = null;
      }
    })();

    return this.activePromise;
  },
};

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
      const shouldRefresh = shouldAttemptSilentRefresh({
        url,
        status: response.status,
        isRetry,
        authToken: readAuthToken(),
      });
      if (shouldRefresh) {
        const refreshed = await refreshManager.attempt();
        if (refreshed) {
          return await fetchJson<T>(url, options, true);
        }
        writeAuthToken(null);
      }

      const errorBody = await parseErrorBody(response);
      throw new ApiError(
        errorBody === null ? `API request failed: ${response.statusText}` : errorBody.error,
        response.status,
        response.statusText,
        errorBody?.code,
      );
    }

    return await readPayload<T>(response);
  } catch (error) {
    if (error instanceof ApiError || error instanceof UnauthenticatedError) throw error;
    throw new NetworkError(error instanceof Error ? error.message : "Network request failed");
  }
}
