/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { apiFetch } from "./api-base";
import { registerAuthTokenBridge } from "./auth-token";

const realFetch = globalThis.fetch;
const TOKEN = "test-session-token";

interface CapturedCall {
  readonly url: string;
  readonly authorization: string | null;
}

const stubFetch = (): CapturedCall[] => {
  const calls: CapturedCall[] = [];
  globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, authorization: new Headers(init?.headers).get("Authorization") });
    return Promise.resolve(new Response("{}", { status: 200 }));
  };
  return calls;
};

afterEach(() => {
  globalThis.fetch = realFetch;
  registerAuthTokenBridge({ read: () => null, write: () => {} });
});

const withToken = (): void => {
  registerAuthTokenBridge({ read: () => TOKEN, write: () => {} });
};

describe("apiFetch authentication prefixes", () => {
  // Every backend route group that requires a session must carry the bearer token.
  const authedPaths = [
    "/api/user/portfolio?walletAddress=0x1",
    "/api/exchange/orders",
    "/api/auth/me",
    "/api/wallets",
  ];

  for (const path of authedPaths) {
    test(`${path} carries the bearer token`, async () => {
      withToken();
      const calls = stubFetch();

      await apiFetch(path);

      expect(calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
    });
  }

  test("an absolute API URL is matched by pathname", async () => {
    withToken();
    const calls = stubFetch();

    await apiFetch("https://api.example.com/api/user/fills?walletAddress=0x1");

    expect(calls[0]?.authorization).toBe(`Bearer ${TOKEN}`);
  });

  test("public routes stay anonymous", async () => {
    withToken();
    const calls = stubFetch();

    await apiFetch("/api/markets");

    expect(calls[0]?.authorization).toBeNull();
  });
});
