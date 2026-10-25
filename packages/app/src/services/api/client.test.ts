/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { shouldAttemptSilentRefresh } from "./client";

const TOKEN = "access-token";

describe("shouldAttemptSilentRefresh", () => {
  test("never refreshes from the refresh endpoint itself", () => {
    for (const url of [
      "/api/auth/refresh",
      "/auth/refresh",
      "https://api.example.com/api/auth/refresh",
      "/api/auth/refresh?redirect=/trade",
    ]) {
      expect(
        shouldAttemptSilentRefresh({ url, status: 401, isRetry: false, authToken: TOKEN }),
      ).toBe(false);
    }
  });

  test("does not refresh when there is no session hint", () => {
    expect(
      shouldAttemptSilentRefresh({
        url: "/api/exchange",
        status: 401,
        isRetry: false,
        authToken: null,
      }),
    ).toBe(false);
    expect(
      shouldAttemptSilentRefresh({
        url: "/api/exchange",
        status: 401,
        isRetry: false,
        authToken: "",
      }),
    ).toBe(false);
  });

  test("silently refreshes an authenticated non-refresh 401 exactly once", () => {
    const decision = {
      url: "/api/exchange",
      status: 401,
      isRetry: false,
      authToken: TOKEN,
    };
    expect(shouldAttemptSilentRefresh(decision)).toBe(true);
    expect(shouldAttemptSilentRefresh({ ...decision, isRetry: true })).toBe(false);
  });

  test("ignores non-401 responses", () => {
    expect(
      shouldAttemptSilentRefresh({
        url: "/api/exchange",
        status: 403,
        isRetry: false,
        authToken: TOKEN,
      }),
    ).toBe(false);
  });
});
