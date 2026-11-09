/// <reference types="bun-types" />
import { describe, expect, test } from "bun:test";

import { queryKeys } from "@/lib/query-keys";
import { agentRegistrationsQueryOptions } from "./use-agent-registrations";

const ADDRESS_A = `0x${"a".repeat(40)}`;
const ADDRESS_B = `0x${"b".repeat(40)}`;

describe("agent registrations query", () => {
  test("scopes the cache key per address", () => {
    expect(queryKeys.user.agentRegistrations(ADDRESS_A)).toEqual([
      "user",
      "agentRegistrations",
      ADDRESS_A,
    ]);
    expect(queryKeys.user.agentRegistrations(ADDRESS_A)).not.toEqual(
      queryKeys.user.agentRegistrations(ADDRESS_B),
    );
  });

  test("is disabled until an address is connected and the user is signed in", () => {
    expect(agentRegistrationsQueryOptions("", true).enabled).toBe(false);
    expect(agentRegistrationsQueryOptions(ADDRESS_A, false).enabled).toBe(false);
    expect(agentRegistrationsQueryOptions(ADDRESS_A, true).enabled).toBe(true);
  });
});
