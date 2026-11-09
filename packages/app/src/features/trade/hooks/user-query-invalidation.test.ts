/// <reference types="bun-types" />
import { describe, expect, mock, test } from "bun:test";
import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";
import {
  adjustLeverageUserQueryKeys,
  cancelAndInvalidateUserQueries,
  cancelOrdersUserQueryKeys,
  marginModeUserQueryKeys,
  placeOrderUserQueryKeys,
} from "./user-query-invalidation";

const ADDRESS = `0x${"a".repeat(40)}`;

interface ClientCall {
  readonly kind: "cancel" | "invalidate";
  readonly queryKey: readonly unknown[];
  readonly refetchType?: string | undefined;
}

function createQueryClientMock() {
  const calls: ClientCall[] = [];
  const cancelQueries = mock(async ({ queryKey }: { queryKey: readonly unknown[] }) => {
    calls.push({ kind: "cancel", queryKey });
  });
  const invalidateQueries = mock(
    async ({ queryKey, refetchType }: { queryKey: readonly unknown[]; refetchType?: string }) => {
      calls.push({ kind: "invalidate", queryKey, refetchType });
    },
  );

  return {
    client: { cancelQueries, invalidateQueries } as unknown as QueryClient,
    calls,
    cancelQueries,
    invalidateQueries,
  };
}

const forbiddenKeys = [
  queryKeys.user.all,
  queryKeys.user.historicalOrders(ADDRESS),
  queryKeys.user.userFunding(ADDRESS),
  queryKeys.user.agentRegistrations(ADDRESS),
];

async function expectTargetedInvalidation(
  run: (client: QueryClient) => Promise<void>,
  expectedKeys: readonly (readonly unknown[])[],
): Promise<void> {
  const { client, calls, cancelQueries, invalidateQueries } = createQueryClientMock();

  await run(client);

  for (const queryKey of expectedKeys) {
    expect(cancelQueries).toHaveBeenCalledWith({ queryKey });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey, refetchType: "active" });
  }
  expect(cancelQueries).toHaveBeenCalledTimes(expectedKeys.length);
  expect(invalidateQueries).toHaveBeenCalledTimes(expectedKeys.length);

  // Every cancellation has to be issued before the first invalidate refetches.
  const lastCancel = calls.reduce(
    (last, call, index) => (call.kind === "cancel" ? index : last),
    -1,
  );
  const firstInvalidate = calls.findIndex((call) => call.kind === "invalidate");
  expect(lastCancel).toBeGreaterThanOrEqual(0);
  expect(firstInvalidate).toBeGreaterThan(lastCancel);

  // The over-broad root and the unrelated user queries must never be touched.
  for (const call of calls) {
    for (const forbidden of forbiddenKeys) {
      expect(call.queryKey).not.toEqual(forbidden);
    }
  }
}

describe("user mutation query invalidation", () => {
  test("place order cancels and refetches state, spot, open orders and fills", async () => {
    await expectTargetedInvalidation(
      (client) => cancelAndInvalidateUserQueries(client, placeOrderUserQueryKeys(ADDRESS)),
      [
        queryKeys.user.clearinghouseState(ADDRESS),
        queryKeys.user.spotClearinghouseState(ADDRESS),
        queryKeys.user.openOrders(ADDRESS),
        queryKeys.user.fills(ADDRESS),
      ],
    );
  });

  test("cancel orders cancels and refetches state, spot and open orders", async () => {
    await expectTargetedInvalidation(
      (client) => cancelAndInvalidateUserQueries(client, cancelOrdersUserQueryKeys(ADDRESS)),
      [
        queryKeys.user.clearinghouseState(ADDRESS),
        queryKeys.user.spotClearinghouseState(ADDRESS),
        queryKeys.user.openOrders(ADDRESS),
      ],
    );
  });

  test("margin mode cancels and refetches clearinghouse state and open orders", async () => {
    await expectTargetedInvalidation(
      (client) => cancelAndInvalidateUserQueries(client, marginModeUserQueryKeys(ADDRESS)),
      [queryKeys.user.clearinghouseState(ADDRESS), queryKeys.user.openOrders(ADDRESS)],
    );
  });

  test("adjust leverage cancels and refetches clearinghouse state and open orders", async () => {
    await expectTargetedInvalidation(
      (client) => cancelAndInvalidateUserQueries(client, adjustLeverageUserQueryKeys(ADDRESS)),
      [queryKeys.user.clearinghouseState(ADDRESS), queryKeys.user.openOrders(ADDRESS)],
    );
  });
});
