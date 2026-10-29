import type { AggregatedMarket } from "@0xsignal/shared";
import type { MarketPrice } from "@/services/api";

const isNonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

export interface MarketHeaderDerivedValues {
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

export interface MarketHeaderDerivationInputs {
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
}: MarketHeaderDerivationInputs): MarketHeaderDerivedValues {
  const tradePrevDayPx = tradeAsset?.prevDayPx;
  const circulatingSupply = tradeAsset?.circulatingSupply;

  return {
    markPrice: livePrice,
    oraclePrice: price?.midPx || price?.markPx || 0,
    change24hAbs:
      isSpot && isNonEmpty(tradePrevDayPx)
        ? livePrice - Number(tradePrevDayPx)
        : (price?.markPx || price?.price || 0) - (price?.prevDayPx || 0),
    change24hPct:
      isSpot && isNonEmpty(tradePrevDayPx) && Number(tradePrevDayPx) > 0
        ? ((livePrice - Number(tradePrevDayPx)) / Number(tradePrevDayPx)) * 100
        : price?.change24h || 0,
    volume24h: isSpot ? Number(tradeAsset?.dayNtlVlm ?? 0) : price?.volume24h || 0,
    openInterest: price?.openInterest || 0,
    fundingRate: price?.funding || 0,
    marketType: tradeAsset?.marketType,
    marketCap:
      isSpot && isNonEmpty(circulatingSupply) ? livePrice * Number(circulatingSupply) : undefined,
    contractAddress: isSpot ? tradeAsset?.evmContract : undefined,
  };
}
