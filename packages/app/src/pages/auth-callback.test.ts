/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { isAborted } from "./auth-callback-utils";

describe("isAborted", () => {
  test("allows navigation while the request is still live", () => {
    const controller = new AbortController();

    expect(isAborted(controller.signal)).toBe(false);
    expect(isAborted()).toBe(false);
  });

  test("blocks navigation after the effect cleanup aborts the request", () => {
    const controller = new AbortController();
    controller.abort();

    expect(isAborted(controller.signal)).toBe(true);
  });
});
