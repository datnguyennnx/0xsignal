import { useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { queryKeys } from "@/lib/query-keys";
import type { AggregatedMarket } from "@0xsignal/shared";
import { parseSymbol } from "../lib/symbol";
import { buildAssetIndexMap, resolveAssetIndex } from "../lib/asset-index";
import { calculatePxDecimals, MAX_DECIMALS_PERP, MAX_SIG_FIGS } from "../utils/trade-formatters";

export interface AssetPrecision {
  pxDecimals: number;
  szDecimals: number;
  maxLeverage: number;
}

export const DEFAULT_PRECISION: AssetPrecision = {
  pxDecimals: Math.min(MAX_SIG_FIGS, MAX_DECIMALS_PERP - 4),
  szDecimals: 4,
  maxLeverage: 50,
};

/** One key rule: `parseSymbol` keeps the dex prefix (lowercased), then uppercase. */
function precisionKey(symbol: string): string {
  return parseSymbol(symbol).coin.toUpperCase();
}

export function buildPrecisionMap(
  assets: readonly AggregatedMarket[],
): Map<string, AssetPrecision> {
  const map = new Map<string, AssetPrecision>();
  for (const asset of assets) {
    if (asset.isDelisted) continue;
    const sz = asset.szDecimals ?? 4;
    const precision: AssetPrecision = {
      pxDecimals: calculatePxDecimals(sz),
      szDecimals: sz,
      maxLeverage: asset.maxLeverage ?? 50,
    };
    // `coin` is bare even on a builder dex (`xyz:TSLA` → `TSLA`), so that key would
    // land on the main-dex entry of the same name; only `rawCoin` names the builder market.
    const identifiers = asset.dexPrefix === null ? [asset.coin, asset.rawCoin] : [asset.rawCoin];
    for (const identifier of identifiers) {
      map.set(precisionKey(identifier), precision);
    }
  }
  return map;
}

export function lookupPrecision(
  map: ReadonlyMap<string, AssetPrecision>,
  sym: string,
): AssetPrecision {
  return map.get(precisionKey(sym)) ?? DEFAULT_PRECISION;
}

export function useHyperliquidMeta() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.market.meta(),
    queryFn: () => api.getMarkets(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const precisionMap = useMemo(() => {
    if (!Array.isArray(data)) return new Map<string, AssetPrecision>();
    return buildPrecisionMap(data);
  }, [data]);

  const assetIndexMap = useMemo(() => {
    if (!Array.isArray(data)) return new Map<string, number>();
    return buildAssetIndexMap(data);
  }, [data]);

  const getPrecision = useCallback(
    (sym: string): AssetPrecision => lookupPrecision(precisionMap, sym),
    [precisionMap],
  );

  const getAssetIndex = useCallback(
    (sym: string): number | null => resolveAssetIndex(assetIndexMap, sym),
    [assetIndexMap],
  );

  return { meta: data, isLoading, error, getPrecision, getAssetIndex, precisionMap };
}
