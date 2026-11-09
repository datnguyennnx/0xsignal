import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query-keys";

type UserQueryKey = readonly unknown[];

/**
 * Cancel in-flight refetches for the affected user queries, then invalidate
 * them again. Cancelling first prevents a stale in-flight request from landing
 * after the mutation and overwriting the fresh data. Invalidating with
 * `refetchType: "active"` avoids refetching queries no screen is observing.
 */
export async function cancelAndInvalidateUserQueries(
  queryClient: QueryClient,
  keys: readonly UserQueryKey[],
): Promise<void> {
  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
  await Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey, refetchType: "active" })),
  );
}

/** Place orders (perp or spot) change positions, balances, orders and fills. */
export function placeOrderUserQueryKeys(address: string): readonly UserQueryKey[] {
  return [
    queryKeys.user.clearinghouseState(address),
    queryKeys.user.spotClearinghouseState(address),
    queryKeys.user.openOrders(address),
    queryKeys.user.fills(address),
  ];
}

/** Cancelling orders (perp or spot) releases balances and removes open orders. */
export function cancelOrdersUserQueryKeys(address: string): readonly UserQueryKey[] {
  return [
    queryKeys.user.clearinghouseState(address),
    queryKeys.user.spotClearinghouseState(address),
    queryKeys.user.openOrders(address),
  ];
}

/** Margin mode and leverage are perp-only; they change the clearinghouse state. */
export function marginModeUserQueryKeys(address: string): readonly UserQueryKey[] {
  return [queryKeys.user.clearinghouseState(address), queryKeys.user.openOrders(address)];
}

export function adjustLeverageUserQueryKeys(address: string): readonly UserQueryKey[] {
  return [queryKeys.user.clearinghouseState(address), queryKeys.user.openOrders(address)];
}
