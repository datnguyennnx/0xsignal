/// <reference types="bun-types" />
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { toast } from "sonner";

import { mergePersistedAuthState, selectPersistedAuthState, useAuthStore } from "./use-auth-store";

const originalFetch = globalThis.fetch;

function urlOf(input: string | URL | Request): string {
  return input instanceof Request ? input.url : String(input);
}

function successFetch(
  refreshCalls: string[],
  captureAuthHeader: (header: string | null) => void,
): typeof fetch {
  const fetcher = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    if (url.endsWith("/auth/refresh")) {
      refreshCalls.push(url);
      return Promise.resolve(
        Response.json({ accessToken: "fresh-token", tokenType: "Bearer", expiresIn: 900 }),
      );
    }
    if (url.endsWith("/auth/me")) {
      captureAuthHeader(new Headers(init?.headers).get("Authorization"));
      return Promise.resolve(
        Response.json({
          userId: "user-1",
          provider: "google",
          avatarUrl: null,
          displayName: "Ada",
        }),
      );
    }
    if (url.endsWith("/wallets")) {
      return Promise.resolve(Response.json([]));
    }
    return Promise.reject(new Error(`unexpected request: ${url}`));
  };
  return Object.assign(fetcher, { preconnect: (_url: string | URL) => {} });
}

function failingRefreshFetch(input: string | URL | Request): Promise<Response> {
  const url = urlOf(input);
  if (url.endsWith("/auth/refresh")) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "Session expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }
  return Promise.reject(new Error(`unexpected request: ${url}`));
}

function resetStore(): void {
  useAuthStore.setState({
    token: null,
    isAuthenticated: false,
    isLoading: true,
    user: null,
    hasLinkedWallet: false,
  });
}

const WAIT_TIMEOUT_MS = 2_000;

function waitFor(predicate: () => boolean, timeoutMs = WAIT_TIMEOUT_MS): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval);
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(interval);
        reject(new Error(`waitFor timed out after ${timeoutMs}ms`));
      }
    }, 5);
  });
}

describe("auth store token handling", () => {
  beforeEach(resetStore);

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetStore();
  });

  test("persisted state never serializes the access token", () => {
    useAuthStore.getState().setToken("super-secret-token");

    const persisted = selectPersistedAuthState(useAuthStore.getState());
    const serialized = JSON.stringify(persisted);

    expect(serialized).not.toContain("super-secret-token");
    expect(serialized).not.toContain("token");
    expect(Object.keys(persisted).toSorted()).toEqual(["hasLinkedWallet", "user"]);
  });

  test("a stale persisted token is dropped on rehydrate", () => {
    const merged = mergePersistedAuthState(
      {
        token: "stale-token",
        isAuthenticated: true,
        user: {
          userId: "user-1",
          provider: "google",
          avatarUrl: null,
          displayName: "Ada",
        },
        hasLinkedWallet: true,
      },
      useAuthStore.getState(),
    );

    expect(merged.token).toBeNull();
    expect(merged.isAuthenticated).toBe(false);
    expect(merged.user?.userId).toBe("user-1");
    expect(merged.hasLinkedWallet).toBe(true);
  });

  test("a fresh mount refreshes exactly once and attaches the token", async () => {
    const refreshCalls: string[] = [];
    const seen: { authHeader: string | null } = { authHeader: null };
    globalThis.fetch = successFetch(refreshCalls, (value) => {
      seen.authHeader = value;
    });

    const cancel = useAuthStore.getState().initialize();
    await waitFor(() => !useAuthStore.getState().isLoading);
    cancel();

    expect(refreshCalls).toHaveLength(1);
    expect(seen.authHeader).toBe("Bearer fresh-token");
    expect(useAuthStore.getState().token).toBe("fresh-token");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user?.userId).toBe("user-1");
  });

  test("a failed refresh signs out without an error toast", async () => {
    const toastError = spyOn(toast, "error");
    globalThis.fetch = Object.assign(failingRefreshFetch, {
      preconnect: (_url: string | URL) => {},
    });

    const cancel = useAuthStore.getState().initialize();
    await waitFor(() => !useAuthStore.getState().isLoading);
    cancel();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(toastError).not.toHaveBeenCalled();

    toastError.mockRestore();
  });
});
