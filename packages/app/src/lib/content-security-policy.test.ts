/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { buildContentSecurityPolicy } from "./content-security-policy";

describe("buildContentSecurityPolicy", () => {
  test("includes the configured absolute API origin and its websocket form", () => {
    const csp = buildContentSecurityPolicy("https://api.example.com/v1");
    expect(csp).toContain("connect-src 'self' https://api.example.com wss://api.example.com");
  });

  test("keeps 'self' for a relative API URL and invents no origin", () => {
    const csp = buildContentSecurityPolicy("/api");
    expect(csp).toContain("connect-src 'self' https://api.hyperliquid.xyz");
    expect(csp).not.toContain("api.example.com");
  });

  test("emits frame-ancestors for the edge to enforce", () => {
    expect(buildContentSecurityPolicy("")).toContain("frame-ancestors 'none'");
  });
});
