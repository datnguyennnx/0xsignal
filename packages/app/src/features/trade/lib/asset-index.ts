import type { AggregatedMarket, MarketTypeCategory } from "@0xsignal/shared";
import { parseSymbol } from "./symbol";

/** Indexes by both identifiers: rawCoin keeps HIP-3/spot distinct, coin tolerates suffixes. */
export function buildAssetIndexMap(markets: readonly AggregatedMarket[]): Map<string, number> {
  const map = new Map<string, number>();
  const kinds = new Map<string, MarketTypeCategory>();
  for (const market of markets) {
    for (const key of [market.rawCoin.toUpperCase(), market.coin.toUpperCase()]) {
      // Precedence: a perp owns a shared bare coin, so a spot row can never overwrite it.
      if (kinds.get(key) === "perp" && market.marketType === "spot") continue;
      map.set(key, market.assetId);
      kinds.set(key, market.marketType);
    }
  }
  return map;
}

export function resolveAssetIndex(map: ReadonlyMap<string, number>, symbol: string): number | null {
  return map.get(parseSymbol(symbol).coin.toUpperCase()) ?? null;
}
