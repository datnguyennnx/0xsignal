/**
 * @overview Hyperliquid Metadata Hook
 *
 * Fetches and manages perpetual asset metadata (universe, decimals, leverage).
 * Provides helper functions for price and size precision formatting.
 *
 * @mechanism
 * - Fetches universe data from Hyperliquid Info API for all DEXes (main + HIP-3)
 * - Memoizes a precision mapping for O(1) lookups during rendering
 * - Uses TanStack Query for long-term metadata caching
 *
 * @hyperliquid-mapping
 * - Main perp (HIP-1): coin = "BTC", "ETH", etc.
 * - Builder perp (HIP-3): coin = "xyz:CL", "km:US500", etc. (format: "dex:coin")
 * - Use meta({ dex }) to query specific DEX
 *
 * @precision-formula
 * Per Hyperliquid spec (llm/hyperliquid/tick-and-slot-size.md):
 * - Perps: pxDecimals = min(5, 6 - szDecimals)
 * - Spot:  pxDecimals = min(5, 8 - szDecimals)
 * This ensures price decimals never exceed MAX_DECIMALS - szDecimals constraint.
 *
 * @reference https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/asset-ids
 */

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi } from "@/services/hyperliquid";
import { queryKeys } from "@/lib/query/query-keys";
import { parseSymbol } from "./use-hyperliquid-ws";

const MAX_DECIMALS_PERP = 6;
const MAX_DECIMALS_SPOT = 8;
const MAX_SIG_FIGS = 5;

export interface AssetPrecision {
  pxDecimals: number;
  szDecimals: number;
}

const DEFAULT: AssetPrecision = {
  pxDecimals: Math.min(MAX_SIG_FIGS, MAX_DECIMALS_PERP - 4),
  szDecimals: 4,
};

export function calculatePxDecimals(szDecimals: number, isSpot = false): number {
  const maxDecimals = isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP;
  return Math.min(MAX_SIG_FIGS, maxDecimals - szDecimals);
}

export function useHyperliquidMeta(symbol?: string) {
  const parsed = symbol ? parseSymbol(symbol) : null;
  const dex = parsed?.kind === "builderPerp" ? parsed.dex : undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.hyperliquid.meta(dex),
    queryFn: () => hyperliquidApi.getMeta(dex),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const precisionMap = useMemo(() => {
    const map = new Map<string, AssetPrecision>();
    if (!data?.universe) return map;
    for (const asset of data.universe) {
      const sz = asset.szDecimals ?? 4;
      const pxDec = calculatePxDecimals(sz, false);
      const key = asset.name.includes(":") ? asset.name : asset.name.toUpperCase();
      map.set(key, {
        pxDecimals: pxDec,
        szDecimals: sz,
      });
    }
    return map;
  }, [data]);

  const getPrecision = useCallback(
    (sym: string): AssetPrecision => {
      const parsed = parseSymbol(sym);
      // For builder perps, lookup using the original coin format (dex:coin)
      // For regular perps, lookup using uppercase
      const lookupKey = parsed.kind === "builderPerp" ? parsed.coin : parsed.coin.toUpperCase();
      return precisionMap.get(lookupKey) ?? DEFAULT;
    },
    [precisionMap]
  );

  return { meta: data, isLoading, error, getPrecision, precisionMap };
}
