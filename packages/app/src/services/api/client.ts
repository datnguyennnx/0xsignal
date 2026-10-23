import type { ApiErrorBody } from "@0xsignal/shared";
import { writeAuthToken } from "@/lib/auth-token";
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

/** Token refresh dedup: single in-flight request with auto-reset. */
const refreshManager = {
  activePromise: null as Promise<boolean> | null,

  attempt(): Promise<boolean> {
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
          const token = isRecord(data) ? data.accessToken : undefined;
          if (typeof token === "string" && token !== "") {
            writeAuthToken(token);
            return true;
          }
        }
        return false;
      } catch {
        return false;
      } finally {
        this.activePromise = null;
      }
    })();

    return this.activePromise;
  },
};

function attemptSilentRefresh(): Promise<boolean> {
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
