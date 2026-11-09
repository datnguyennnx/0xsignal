/// <reference types="bun-types" />
/**
 * Route-motion contract.
 *
 * Screen switches are animated by one wrapper keyed on the route *pattern*.
 * The key helper is pure, so it is tested directly; the wiring is pinned at the
 * source level because there is no DOM harness here.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { routeMotionKey } from "./route-motion";

const ROUTER_SOURCE = readFileSync(new URL("../app-router.tsx", import.meta.url), "utf8");

const PAGE_ROOTS = [
  "portfolio",
  "whales",
  "whale-detail",
  "calendar",
  "settings",
  "login",
  "not-found",
] as const;

describe("routeMotionKey", () => {
  test("the same route pattern keeps the same key", () => {
    expect(routeMotionKey({ path: "/trade/:symbol" })).toBe(
      routeMotionKey({ path: "/trade/:symbol" }),
    );
  });

  test("different screens produce different keys", () => {
    const paths = ["/trade/:symbol", "/portfolio", "/whales", "/calendar", "/settings", "*"];
    const keys = new Set(paths.map((path) => routeMotionKey({ path })));
    expect(keys.size).toBe(paths.length);
  });
});

describe("route enter wrapper", () => {
  test("AppRouter keys its wrappers by route pattern, never by pathname", () => {
    expect(ROUTER_SOURCE).toContain("key={routeMotionKey(record)}");
    expect(ROUTER_SOURCE).not.toContain("key={pathname}");
  });

  test("AppRouter owns the only content-enter wrappers", () => {
    // One inside MainLayout, one on the bare-route boundary.
    expect(ROUTER_SOURCE.match(/content-enter/g)?.length).toBe(2);
  });

  test("page roots no longer animate themselves", () => {
    for (const page of PAGE_ROOTS) {
      const source = readFileSync(new URL(`../pages/${page}.tsx`, import.meta.url), "utf8");
      expect(source).not.toContain("content-enter");
    }
  });
});
