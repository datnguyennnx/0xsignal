/// <reference types="bun-types" />
import { afterEach, describe, expect, test } from "bun:test";

import { ASSET_PRICE_REFRESH_MS, assetPriceRefetchInterval } from "./use-asset-price";

const installDocument = (visibilityState: DocumentVisibilityState): void => {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { visibilityState },
  });
};

afterEach(() => {
  Reflect.deleteProperty(globalThis, "document");
});

describe("asset price refresh interval", () => {
  test("refreshes every 20s while the tab is visible", () => {
    installDocument("visible");

    expect(ASSET_PRICE_REFRESH_MS).toBe(20_000);
    expect(assetPriceRefetchInterval()).toBe(ASSET_PRICE_REFRESH_MS);
  });

  test("stops polling while the tab is hidden", () => {
    installDocument("hidden");

    expect(assetPriceRefetchInterval()).toBe(false);
  });
});
