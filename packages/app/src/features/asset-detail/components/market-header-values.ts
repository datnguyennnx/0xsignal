import type { AggregatedMarket } from "@0xsignal/shared";
import type { MarketPrice } from "@/services/api";

const isNonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

export interface MarketHeaderValues {
  readonly markPrice: number;
  readonly oraclePrice: number;
  readonly change24hAbs: number;
  readonly change24hPct: number;
  readonly volume24h: number;
  readonly openInterest: number;
  readonly fundingRate: number;
  readonly marketType: "perp" | "spot" | undefined;
  readonly marketCap: number | undefined;
  readonly contractAddress: string | undefined;
}

export interface MarketHeaderInput {
  readonly isSpot: boolean;
  readonly livePrice: number;
  readonly price: MarketPrice;
  readonly tradeAsset: AggregatedMarket | undefined;
}

export function deriveMarketHeaderValues({
  isSpot,
  livePrice,
  price,
  tradeAsset,
}: MarketHeaderInput): MarketHeaderValues {
  const tradePrevDayPx = tradeAsset?.prevDayPx;
  const circulatingSupply = tradeAsset?.circulatingSupply;
  const quote = price.quote ?? null;
  const midPx = quote?.midPx ?? 0;
  const markPx = quote?.markPx ?? 0;
  const quotePrice = quote?.price ?? 0;
  const prevDayPx = quote?.prevDayPx ?? 0;
  // Hyperliquid reports `openInterest` in coin units; the header shows USD = units × mark.
  const openInterestUsd =
    Number.isFinite(livePrice) && livePrice > 0 ? (quote?.openInterest ?? 0) * livePrice : 0;

  return {
    markPrice: livePrice,
    oraclePrice: midPx || markPx || 0,
    change24hAbs:
      isSpot && isNonEmpty(tradePrevDayPx)
        ? livePrice - Number(tradePrevDayPx)
        : (markPx || quotePrice || 0) - prevDayPx,
    change24hPct:
      isSpot && isNonEmpty(tradePrevDayPx) && Number(tradePrevDayPx) > 0
        ? ((livePrice - Number(tradePrevDayPx)) / Number(tradePrevDayPx)) * 100
        : (quote?.change24h ?? 0),
    volume24h: isSpot ? Number(tradeAsset?.dayNtlVlm ?? 0) : (quote?.volume24h ?? 0),
    openInterest: openInterestUsd,
    fundingRate: quote?.funding ?? 0,
    marketType: tradeAsset?.marketType,
    marketCap:
      isSpot && isNonEmpty(circulatingSupply) ? livePrice * Number(circulatingSupply) : undefined,
    contractAddress: isSpot ? tradeAsset?.evmContract : undefined,
  };
}
