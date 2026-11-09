import { useClearinghouseState, useOpenOrders } from "./use-user-data";
import { useUserBalances, useWhaleBalances } from "./use-user-balances";
import { useIsSigningDisabled } from "@/hooks/use-effective-address";
import type { PositionRow } from "../components/positions-table";
import {
  useWhaleClearinghouseState,
  useWhaleOpenOrders,
} from "@/features/portfolio/hooks/use-portfolio-data";

interface PositionBalances {
  positions: PositionRow[];
  balanceCount: number;
  positionsCount: number;
  isChLoading: boolean;
}

interface ClearinghouseQueryLike {
  isError: boolean;
  refetch: () => unknown;
}

interface WhaleClearinghouseQueryLike extends ClearinghouseQueryLike {
  data?: { assetPositions?: PositionRow[] } | undefined;
  isLoading: boolean;
}

interface OrdersQueryLike {
  data?: readonly unknown[] | undefined;
  isLoading: boolean;
}

export interface PositionManagementSources {
  readOnly: boolean;
  ownBalances: PositionBalances;
  whaleBalances: PositionBalances;
  ownChState: ClearinghouseQueryLike;
  whaleState: WhaleClearinghouseQueryLike;
  ownOpenOrders: OrdersQueryLike;
  whaleOpenOrders: OrdersQueryLike;
}

export interface PositionTabCounts {
  balances: number | undefined;
  positions: number | undefined;
  openOrders: number | undefined;
}

export interface PositionManagementData {
  balanceCount: number;
  positions: PositionRow[];
  positionsCount: number;
  isChLoading: boolean;
  isChError: boolean;
  retryPositions: () => unknown;
  openOrdersCount: number;
  isOoLoading: boolean;
}

/** Read-only views read the whale queries; live views read the signed-in user's. */
export function selectPositionManagementData(
  sources: PositionManagementSources,
): PositionManagementData {
  const balances = sources.readOnly ? sources.whaleBalances : sources.ownBalances;
  const clearinghouse = sources.readOnly ? sources.whaleState : sources.ownChState;
  const openOrders = sources.readOnly ? sources.whaleOpenOrders : sources.ownOpenOrders;
  const positions = sources.readOnly
    ? (sources.whaleState.data?.assetPositions ?? [])
    : balances.positions;

  return {
    balanceCount: balances.balanceCount,
    positions,
    positionsCount: sources.readOnly ? positions.length : balances.positionsCount,
    isChLoading: sources.readOnly ? sources.whaleState.isLoading : balances.isChLoading,
    isChError: clearinghouse.isError,
    retryPositions: clearinghouse.refetch,
    openOrdersCount: openOrders.data?.length ?? 0,
    isOoLoading: openOrders.isLoading,
  };
}

/** Tab badges stay blank until their source query settles. */
export function selectTabCounts(
  data: Pick<
    PositionManagementData,
    "balanceCount" | "positionsCount" | "openOrdersCount" | "isChLoading" | "isOoLoading"
  >,
): PositionTabCounts {
  return {
    balances: data.isChLoading ? undefined : data.balanceCount,
    positions: data.isChLoading ? undefined : data.positionsCount,
    openOrders: data.isOoLoading ? undefined : data.openOrdersCount,
  };
}

export function usePositionManagementData(readOnlyAddress?: string) {
  const readOnly = readOnlyAddress !== undefined;
  const signingDisabled = useIsSigningDisabled() || readOnly;
  const whaleState = useWhaleClearinghouseState(readOnlyAddress);
  const ownChState = useClearinghouseState(!readOnly);
  const ownBalances = useUserBalances(!readOnly);
  const whaleBalances = useWhaleBalances(readOnlyAddress);
  const ownOpenOrders = useOpenOrders(!readOnly);
  const whaleOpenOrders = useWhaleOpenOrders(readOnlyAddress);

  const data = selectPositionManagementData({
    readOnly,
    ownBalances,
    whaleBalances,
    ownChState,
    whaleState,
    ownOpenOrders,
    whaleOpenOrders,
  });

  return {
    readOnly,
    signingDisabled,
    ...data,
    tabCounts: selectTabCounts(data),
  };
}
