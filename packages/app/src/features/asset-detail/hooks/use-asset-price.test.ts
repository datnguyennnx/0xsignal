/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { restoreDomGlobals } from "../../../../test/setup";

import { assetPriceRefetchInterval } from "./use-asset-price";

const installDocument = (visibilityState: DocumentVisibilityState): void => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { visibilityState },
  });
};

afterEach(() => {
  restoreDomGlobals();
});

describe("asset price refresh interval", () => {
  test("refreshes every 20s while the tab is visible", () => {
    installDocument("visible");

    expect(assetPriceRefetchInterval()).toBe(20_000);
  });

  test("stops polling while the tab is hidden", () => {
    installDocument("hidden");

    expect(assetPriceRefetchInterval()).toBe(false);
  });
});
