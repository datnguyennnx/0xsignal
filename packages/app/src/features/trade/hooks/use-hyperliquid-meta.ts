import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query/query-keys";
import { parseSymbol } from "../lib/symbol";
import { calculatePxDecimals, MAX_DECIMALS_PERP, MAX_SIG_FIGS } from "../utils/trade-formatters";

export interface AssetPrecision {
  pxDecimals: number;
  szDecimals: number;
  maxLeverage: number;
}

const DEFAULT: AssetPrecision = {
  pxDecimals: Math.min(MAX_SIG_FIGS, MAX_DECIMALS_PERP - 4),
  szDecimals: 4,
  maxLeverage: 50,
};

export function useHyperliquidMeta() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.market.meta(),
    queryFn: () => api.getMarkets(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const precisionMap = useMemo(() => {
    const map = new Map<string, AssetPrecision>();
    if (!Array.isArray(data)) return map;
    for (const asset of data) {
      if (asset.isDelisted) continue;
      const sz = asset.szDecimals ?? 4;
      const pxDec = calculatePxDecimals(sz);
      const ml = asset.maxLeverage ?? 50;
      map.set(asset.coin.toUpperCase(), {
        pxDecimals: pxDec,
        szDecimals: sz,
        maxLeverage: ml,
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
    [precisionMap],
  );

  return { meta: data, isLoading, error, getPrecision, precisionMap };
}
