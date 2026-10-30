import { useMemo } from "react";
import type { AggregatedMarket } from "@0xsignal/shared";

import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { buildAssetIndexMap } from "@/features/trade/lib/asset-index";

import { parsePx } from "./use-coin-market";

interface CoinAsset {
  asset: AggregatedMarket | undefined;
  markPx: number | null;
}

const NO_MARKETS: readonly AggregatedMarket[] = [];

/**
 * The id arrives from a route, so it is a bare name (`BTC`), a builder id
 * (`xyz:GOLD`), a spot id (`@166`) or a mixed-case ticker (`kPEPE`) — never a
 * normalised symbol, and uppercasing it is what broke the builder and
 * mixed-case lookups. `buildAssetIndexMap` already keys both `rawCoin` and
 * `coin`; the scans behind it cover `name` and any row the index cannot name.
 * `useHyperliquidMeta` exposes only `getAssetIndex` (id, via `parseSymbol`), not
 * the map, and the panel needs the whole row for `markPx` and open interest.
 */
function resolveCoinAsset(
  markets: readonly AggregatedMarket[],
  coin: string,
): AggregatedMarket | undefined {
  if (coin === "") return undefined;

  const key = coin.toUpperCase();
  const assetId = buildAssetIndexMap(markets).get(key);
  const indexed = assetId === undefined ? undefined : markets.find((m) => m.assetId === assetId);
  if (indexed !== undefined) return indexed;

  return (
    markets.find((market) => market.rawCoin.toUpperCase() === key) ??
    markets.find((market) => market.coin.toUpperCase() === key) ??
    markets.find((market) => market.name.toUpperCase() === key)
  );
}

/** The single market-metadata dependency of the coin panel and its dialog. */
export function useCoinAsset(coin: string): CoinAsset {
  const { meta } = useHyperliquidMeta();
  const asset = useMemo(() => resolveCoinAsset(meta ?? NO_MARKETS, coin), [meta, coin]);

  return { asset, markPx: parsePx(asset?.markPx) };
}
