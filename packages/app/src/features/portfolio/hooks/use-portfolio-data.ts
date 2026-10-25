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
  return useQuery(whaleClearinghouseStateQuery(address));
}

/** Public spot balances for a third party; address-gated, never auth-gated. */
export function useWhaleSpotClearinghouseState(address?: string) {
  return useQuery<SpotClearinghouseState>({
    queryKey: queryKeys.whales.spotClearinghouseState(address ?? ""),
    queryFn: () => getSpotClearinghouseStatePublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useWhaleOpenOrders(address?: string) {
  return useQuery<OpenOrder[]>({
    queryKey: queryKeys.whales.openOrders(address ?? ""),
    queryFn: () => getOpenOrdersPublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useWhaleFills(address?: string) {
  return useQuery<UserFill[]>({
    queryKey: queryKeys.whales.fills(address ?? ""),
    queryFn: () => getUserFillsPublic(address ?? ""),
    enabled: address !== undefined && address !== "",
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
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
