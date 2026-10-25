import type { AggregatedMarket } from "@0xsignal/shared";
import { parseSymbol } from "./symbol";

/** Indexes by both identifiers: rawCoin keeps HIP-3/spot distinct, coin tolerates suffixes. */
export function buildAssetIndexMap(markets: readonly AggregatedMarket[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const market of markets) {
    map.set(market.rawCoin.toUpperCase(), market.assetId);
    map.set(market.coin.toUpperCase(), market.assetId);
  }
  return map;
}

export function resolveAssetIndex(map: ReadonlyMap<string, number>, symbol: string): number | null {
  return map.get(parseSymbol(symbol).coin.toUpperCase()) ?? null;
}
