/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { ROUTES, titleForPath } from "./routes";

describe("titleForPath", () => {
  test("resolves the static page titles applied by RouteTitle", () => {
    expect(titleForPath("/portfolio")).toBe("Portfolio");
    expect(titleForPath("/whales")).toBe("Whales");
    expect(titleForPath("/whales/0x0000000000000000000000000000000000000002")).toBe("Whale");
  });

  test("returns undefined for asset routes so the page owns its dynamic title", () => {
    expect(titleForPath("/trade/BTC")).toBeUndefined();
    expect(titleForPath("/trade/PURR/USDC")).toBeUndefined();
  });

  test("falls back to the wildcard title for an unknown path", () => {
    expect(titleForPath("/not-a-route")).toBe("Not Found");
  });

  test("no page title is duplicated by a page-level title write", () => {
    const titled = ROUTES.filter((route) => route.title !== undefined).map((route) => route.path);
    expect(titled).toContain("/portfolio");
    expect(titled).toContain("/whales");
    expect(titled).toContain("/whales/:address");
    expect(titled).not.toContain("/trade/:symbol");
    expect(titled).not.toContain("/trade/:base/:quote");
  });
});
