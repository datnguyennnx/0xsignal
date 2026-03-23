/**
 * @overview Hyperliquid Metadata Hook
 *
 * Fetches and manages perpetual asset metadata (universe, decimals, leverage).
 * Provides helper functions for price and size precision formatting.
 *
 * @mechanism
 * - Fetches universe data from Hyperliquid Info API
 * - Memoizes a precision mapping for O(1) lookups during rendering
 * - Uses TanStack Query for long-term metadata caching
 *
 * @strategy 5min stale time as exchange metadata rarely changes during a session.
 */

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi } from "@/services/hyperliquid";
import { queryKeys } from "@/lib/query/query-keys";

const MAX_DECIMALS_PERP = 6;

export interface AssetPrecision {
  pxDecimals: number;
  szDecimals: number;
}

const DEFAULT: AssetPrecision = { pxDecimals: 5, szDecimals: 4 };

export function useHyperliquidMeta() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.hyperliquid.meta(),
    queryFn: () => hyperliquidApi.getMeta(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const precisionMap = useMemo(() => {
    const map = new Map<string, AssetPrecision>();
    if (!data?.universe) return map;
    for (const asset of data.universe) {
      const pxDec = 5; // Default to 5 decimals for perp prices
      const sz = asset.szDecimals ?? 4;
      map.set(asset.name.toUpperCase(), {
        pxDecimals: Math.min(pxDec, MAX_DECIMALS_PERP),
        szDecimals: sz,
      });
    }
    return map;
  }, [data]);

  const getPrecision = useCallback(
    (symbol: string): AssetPrecision => {
      const norm = symbol.toUpperCase().replace(/USDT?$/, "");
      return precisionMap.get(norm) ?? DEFAULT;
    },
    [precisionMap]
  );

  return { meta: data, isLoading, error, getPrecision, precisionMap };
}
