import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  ClearinghouseState,
  HistoricalOrderEntry,
  OpenOrder,
  SpotClearinghouseState,
  UserFill,
  UserFundingEntry,
} from "@0xsignal/shared";
import {
  getClearinghouseStatePublic,
  getHistoricalOrdersPublic,
  getOpenOrdersPublic,
  getPortfolio,
  getPortfolioPublic,
  getSpotClearinghouseStatePublic,
  getUserFillsPublic,
  getUserFundingPublic,
  getUserVaultEquities,
  getUserVaultEquitiesPublic,
} from "@/services/hl-rest-client";
import { queryKeys } from "@/lib/query-keys";
import { useOwnAddress } from "@/hooks/use-effective-address";
import { isPageHidden } from "@/lib/page-visibility";
import { useWhaleAccountStream } from "./use-whale-account-stream";

/** Pace of the public REST read while the whale stream is not confirmed. */
const WHALE_REST_FALLBACK_MS = 30 * 1000;

/** A hidden tab keeps its stale snapshot instead of polling in the background. */
function whaleRestRefetchInterval(restAllowed: boolean, live: boolean): number | false {
  return restAllowed && !live && !isPageHidden() ? WHALE_REST_FALLBACK_MS : false;
}

type WhaleStreamChannel = "clearinghouseState" | "spotState" | "openOrders" | "userFills";

interface WhaleChannelStatus {
  readonly live: boolean;
  readonly restAllowed: boolean;
}

type WhaleStatusMap = Readonly<Record<WhaleStreamChannel, WhaleChannelStatus>>;

/** No bridge mounted (or a page without a whale): REST is the only source. */
const IDLE_WHALE_STATUS: WhaleChannelStatus = { live: false, restAllowed: true };

const whaleStatusByAddress = new Map<string, WhaleStatusMap>();
const whaleStatusListeners = new Set<() => void>();

function notifyWhaleStatus(): void {
  for (const listener of whaleStatusListeners) listener();
}

function subscribeWhaleStatus(listener: () => void): () => void {
  whaleStatusListeners.add(listener);
  return () => {
    whaleStatusListeners.delete(listener);
  };
}

function readWhaleStatus(address: string, channel: WhaleStreamChannel): WhaleChannelStatus {
  if (address === "") return IDLE_WHALE_STATUS;
  return whaleStatusByAddress.get(address)?.[channel] ?? IDLE_WHALE_STATUS;
}

/** Reads the stream status the bridge publishes; it never subscribes itself. */
export function useWhaleChannelStatus(
  address: string | undefined,
  channel: WhaleStreamChannel,
): WhaleChannelStatus {
  const user = address ?? "";
  return useSyncExternalStore(
    subscribeWhaleStatus,
    () => readWhaleStatus(user, channel),
    () => IDLE_WHALE_STATUS,
  );
}

/**
 * Mounts the one live account socket per address. It writes every whale query
 * key; the query hooks below only read the cache, so N consumers share one
 * subscription.
 */
export function useWhaleStreamBridge(address?: string): void {
  const stream = useWhaleAccountStream(address);
  const user = address ?? "";
  const { live: chLive, restAllowed: chRest } = stream.clearinghouseState;
  const { live: spotLive, restAllowed: spotRest } = stream.spotState;
  const { live: ordersLive, restAllowed: ordersRest } = stream.openOrders;
  const { live: fillsLive, restAllowed: fillsRest } = stream.userFills;

  useEffect(() => {
    if (user === "") return () => {};
    const status: WhaleStatusMap = {
      clearinghouseState: { live: chLive, restAllowed: chRest },
      spotState: { live: spotLive, restAllowed: spotRest },
      openOrders: { live: ordersLive, restAllowed: ordersRest },
      userFills: { live: fillsLive, restAllowed: fillsRest },
    };
    whaleStatusByAddress.set(user, status);
    notifyWhaleStatus();
    return () => {
      if (whaleStatusByAddress.delete(user)) notifyWhaleStatus();
    };
  }, [user, chLive, chRest, spotLive, spotRest, ordersLive, ordersRest, fillsLive, fillsRest]);
}

export function usePortfolio(enabled: boolean = true) {
  const ownAddress = useOwnAddress();
  return useQuery({
    queryKey: queryKeys.user.portfolio(ownAddress ?? ""),
    queryFn: () => getPortfolio(ownAddress ?? ""),
    enabled: enabled && ownAddress !== undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useUserVaultEquities(enabled: boolean = true) {
  const ownAddress = useOwnAddress();
  return useQuery({
    queryKey: queryKeys.user.vaultEquities(ownAddress ?? ""),
    queryFn: () => getUserVaultEquities(ownAddress ?? ""),
    enabled: enabled && ownAddress !== undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Read-only account data for a whale. Uses the public direct client only, so a
 * third party's data never travels through an authenticated backend call.
 */
export function useWhalePortfolio(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.whales.portfolio(address ?? ""),
    queryFn: () => getPortfolioPublic(address ?? ""),
    enabled: address !== undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useWhaleVaultEquities(address: string | undefined) {
  return useQuery({
    queryKey: queryKeys.whales.vaultEquities(address ?? ""),
    queryFn: () => getUserVaultEquitiesPublic(address ?? ""),
    enabled: address !== undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

/**
 * Public clearinghouse read for a third party. Direct-only and address-gated:
 * no wallet connection and no auth session are required to see the whale.
 */
export interface WhaleClearinghouseQuery {
  readonly queryKey: readonly unknown[];
  readonly queryFn: () => Promise<ClearinghouseState>;
  readonly enabled: boolean;
  readonly staleTime: number;
  readonly refetchOnWindowFocus: boolean;
}

export function whaleClearinghouseStateQuery(address?: string): WhaleClearinghouseQuery {
  return {
    queryKey: queryKeys.whales.clearinghouseState(address ?? ""),
    queryFn: () => getClearinghouseStatePublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: 10 * 1000,
    refetchOnWindowFocus: false,
  };
}

export function useWhaleClearinghouseState(address?: string) {
  const { live, restAllowed } = useWhaleChannelStatus(address, "clearinghouseState");
  const base = whaleClearinghouseStateQuery(address);
  return useQuery({
    ...base,
    staleTime: live ? Infinity : base.staleTime,
    refetchOnWindowFocus: !live,
    refetchInterval: () => whaleRestRefetchInterval(restAllowed, live),
  });
}

/** Public spot balances for a third party; address-gated, never auth-gated. */
export function useWhaleSpotClearinghouseState(address?: string) {
  const { live, restAllowed } = useWhaleChannelStatus(address, "spotState");
  return useQuery<SpotClearinghouseState>({
    queryKey: queryKeys.whales.spotClearinghouseState(address ?? ""),
    queryFn: () => getSpotClearinghouseStatePublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => whaleRestRefetchInterval(restAllowed, live),
  });
}

export function useWhaleOpenOrders(address?: string) {
  const { live, restAllowed } = useWhaleChannelStatus(address, "openOrders");
  return useQuery<OpenOrder[]>({
    queryKey: queryKeys.whales.openOrders(address ?? ""),
    queryFn: () => getOpenOrdersPublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => whaleRestRefetchInterval(restAllowed, live),
  });
}

export function useWhaleFills(address?: string) {
  const { live, restAllowed } = useWhaleChannelStatus(address, "userFills");
  return useQuery<UserFill[]>({
    queryKey: queryKeys.whales.fills(address ?? ""),
    queryFn: () => getUserFillsPublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: live ? Infinity : 30 * 1000,
    refetchOnWindowFocus: !live,
    refetchInterval: () => whaleRestRefetchInterval(restAllowed, live),
  });
}

export function useWhaleFunding(address?: string) {
  return useQuery<UserFundingEntry[]>({
    queryKey: queryKeys.whales.userFunding(address ?? ""),
    queryFn: () => getUserFundingPublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useWhaleHistoricalOrders(address?: string) {
  return useQuery<HistoricalOrderEntry[]>({
    queryKey: queryKeys.whales.historicalOrders(address ?? ""),
    queryFn: () => getHistoricalOrdersPublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
