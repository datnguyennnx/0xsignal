/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  buildContentSecurityPolicy,
  buildContentSecurityPolicyReportOnly,
} from "./content-security-policy";

const NGINX_CONF = readFileSync(new URL("../../nginx.conf", import.meta.url), "utf8");

/** Directive order, source order and internal spacing are semantically irrelevant. */
const normalize = (policy: string): ReadonlyMap<string, ReadonlySet<string>> => {
  const directives = new Map<string, ReadonlySet<string>>();
  for (const part of policy.split(";")) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name === undefined || name === "") continue;
    directives.set(name, new Set(sources));
  }
  return directives;
};

const edgePolicies = (): readonly string[] =>
  [...NGINX_CONF.matchAll(/add_header Content-Security-Policy "([^"]+)" always;/g)].map(
    (match) => match[1] ?? "",
  );

const edgeReportOnlyPolicies = (): readonly string[] =>
  [...NGINX_CONF.matchAll(/add_header Content-Security-Policy-Report-Only "([^"]+)" always;/g)].map(
    (match) => match[1] ?? "",
  );

describe("nginx edge CSP", () => {
  test("both edge headers match the generated build policy", () => {
    const expected = normalize(buildContentSecurityPolicy());
    const policies = edgePolicies();
    expect(policies).toHaveLength(2);
    for (const policy of policies) expect(normalize(policy)).toEqual(expected);
  });

  test("connect-src names exact origins instead of the https:/wss: catch-alls", () => {
    for (const policy of edgePolicies()) {
      expect(policy).not.toMatch(/connect-src[^;]*\shttps:\s/);
      expect(policy).not.toMatch(/connect-src[^;]*\swss:\s/);
    }
  });
});

describe("nginx edge trusted types", () => {
  test("both edge report-only headers match the generated report-only policy", () => {
    const expected = normalize(buildContentSecurityPolicyReportOnly());
    const policies = edgeReportOnlyPolicies();
    expect(policies).toHaveLength(2);
    for (const policy of policies) expect(normalize(policy)).toEqual(expected);
  });

  test("both edge report-only headers carry the trusted types directives", () => {
    const policies = edgeReportOnlyPolicies();
    expect(policies).toHaveLength(2);
    for (const policy of policies) {
      const directives = normalize(policy);
      expect(directives.get("trusted-types")).toEqual(new Set(["default"]));
      expect(directives.get("require-trusted-types-for")).toEqual(new Set(["'script'"]));
    }
  });

  test("report-only adds exactly the two trusted types directives", () => {
    const enforced = normalize(buildContentSecurityPolicy());
    const reportOnly = normalize(buildContentSecurityPolicyReportOnly());
    const added = [...reportOnly.keys()].filter((name) => !enforced.has(name));
    expect(new Set(added)).toEqual(new Set(["trusted-types", "require-trusted-types-for"]));
    expect(reportOnly.size).toBe(enforced.size + 2);
  });

  test("the enforcing edge headers stay free of trusted types", () => {
    for (const policy of edgePolicies()) {
      const directives = normalize(policy);
      expect(directives.has("trusted-types")).toBe(false);
      expect(directives.has("require-trusted-types-for")).toBe(false);
    }
  });
});
