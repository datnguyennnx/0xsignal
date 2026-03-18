/**
 * @fileoverview Hyperliquid Metadata Hook
 *
 * Fetches symbol precision from Hyperliquid API for price formatting.
 *
 * @cache 5min stale, 10min GC
 * @memoized precisionMap and getPrecision
 *
 * @precision-guide
 * - BTC, ETH: pxDecimals = 2-3
 * - SOL: pxDecimals = 3-4
 * - Small altcoins: pxDecimals = 5-6
 */

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi } from "@/services/hyperliquid";
import { queryKeys } from "@/lib/query/query-keys";

const MAX_DECIMALS_PERP = 6;
const MAX_DECIMALS_SPOT = 8;

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
