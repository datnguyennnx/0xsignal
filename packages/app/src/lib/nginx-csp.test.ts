/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import { buildContentSecurityPolicy } from "./content-security-policy";

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
