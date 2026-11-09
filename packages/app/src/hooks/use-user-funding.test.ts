/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { isUserFundingEnabled } from "./use-user-funding";

const ADDRESS = `0x${"a".repeat(40)}`;

describe("isUserFundingEnabled", () => {
  test("is enabled only for a non-empty address while the caller allows it", () => {
    expect(isUserFundingEnabled(ADDRESS, true)).toBe(true);
    expect(isUserFundingEnabled(ADDRESS, false)).toBe(false);
  });

  test("treats a missing or empty address as disabled", () => {
    expect(isUserFundingEnabled(undefined, true)).toBe(false);
    expect(isUserFundingEnabled("", true)).toBe(false);
  });
});
