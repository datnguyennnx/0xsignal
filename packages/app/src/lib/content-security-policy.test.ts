/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import {
  buildContentSecurityPolicy,
  buildContentSecurityPolicyReportOnly,
} from "./content-security-policy";

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

describe("buildContentSecurityPolicyReportOnly", () => {
  test("keeps every enforced directive when adding trusted types", () => {
    const reportOnly = buildContentSecurityPolicyReportOnly("https://api.example.com/v1");
    for (const directive of buildContentSecurityPolicy("https://api.example.com/v1").split("; ")) {
      expect(reportOnly).toContain(directive);
    }
  });

  test("ships trusted types only on the report-only policy", () => {
    expect(buildContentSecurityPolicyReportOnly("")).toContain(
      "trusted-types default; require-trusted-types-for 'script'",
    );
    expect(buildContentSecurityPolicy("")).not.toContain("require-trusted-types-for");
    expect(buildContentSecurityPolicy("")).not.toMatch(/(?:^|; )trusted-types /);
  });

  test("derives connect-src for the report-only policy too", () => {
    const reportOnly = buildContentSecurityPolicyReportOnly("https://api.example.com/v1");
    expect(reportOnly).toContain("connect-src 'self' https://api.example.com");
    expect(reportOnly).toContain("wss://api.example.com");
  });
});
