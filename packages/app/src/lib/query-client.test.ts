/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { ApiError } from "./api-error";
import { UnauthenticatedError } from "./api-base";
import { shouldRetryQuery } from "./query-client";

describe("shouldRetryQuery", () => {
  test("never retries auth or missing-resource statuses", () => {
    for (const status of [401, 403, 404]) {
      expect(shouldRetryQuery(0, new ApiError(`status ${status}`, status))).toBe(false);
    }
  });

  test("decides by status code, not by message text", () => {
    expect(shouldRetryQuery(0, new ApiError("404 Not Found", 500))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError("Unauthorized", 500))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError("server exploded", 401))).toBe(false);
  });

  test("does not retry a request rejected before it was sent without credentials", () => {
    expect(shouldRetryQuery(0, new UnauthenticatedError("Authentication required"))).toBe(false);
  });

  test("retries transient failures twice at most", () => {
    const serverError = new ApiError("server exploded", 500);
    expect(shouldRetryQuery(0, serverError)).toBe(true);
    expect(shouldRetryQuery(1, serverError)).toBe(true);
    expect(shouldRetryQuery(2, serverError)).toBe(false);
  });
});
