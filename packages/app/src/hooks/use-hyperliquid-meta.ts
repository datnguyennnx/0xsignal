/**
 * Hyperliquid Metadata Hook
 *
 * Fetches symbol precision (pxDecimals, szDecimals) from Hyperliquid API.
 * Used for: price formatting, orderbook aggregation, order placement.
 *
 * @cache 5min stale, 10min garbage collection
 * @memoized precisionMap and getPrecision callback
 */

import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { hyperliquidApi } from "@/services/hyperliquid";

const MAX_DECIMALS_PERP = 6;
const MAX_DECIMALS_SPOT = 8;

export interface AssetPrecision {
  pxDecimals: number;
  szDecimals: number;
}

const DEFAULT: AssetPrecision = { pxDecimals: 2, szDecimals: 4 };

function calcPxDecimals(szDecimals: number, isSpot = false): number {
  const max = isSpot ? MAX_DECIMALS_SPOT : MAX_DECIMALS_PERP;
  return Math.max(0, Math.min(max - szDecimals, max));
}

export function useHyperliquidMeta() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["hyperliquid-meta"],
    queryFn: () => hyperliquidApi.getMeta(),
    staleTime: 300_000,
    gcTime: 600_000,
    refetchOnWindowFocus: false,
  });

  const precisionMap = useMemo(() => {
    const map = new Map<string, AssetPrecision>();
    if (!data?.universe) return map;
    for (const asset of data.universe) {
      const sz = asset.szDecimals ?? 4;
      map.set(asset.name.toUpperCase(), {
        pxDecimals: calcPxDecimals(sz),
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
