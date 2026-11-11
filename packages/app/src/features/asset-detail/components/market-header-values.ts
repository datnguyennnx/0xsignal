import type { AggregatedMarket } from "@0xsignal/shared";
import type { MarketPrice } from "@/services/api";
import type { AssetCtxSnapshot } from "@/features/trade/lib/asset-ctx";
import {
  formatCompactUsd,
  formatFundingPercent,
  formatPrice,
  formatSignedPercent,
} from "@/core/utils/formatters";
import { contractAddressText } from "../utils/contract-address";

const DASH = "--";

const isNonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

const finiteOrNull = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const positiveOrNull = (value: number | null | undefined): number | null => {
  const finite = finiteOrNull(value);
  return finite !== null && finite > 0 ? finite : null;
};

const fullUsdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatSignedUsdFull = (value: number): string =>
  `${value >= 0 ? "+" : "-"}${fullUsdFormatter.format(Math.abs(value))}`;

export const formatHeaderPrice = (value: number | null): string =>
  value === null ? DASH : formatPrice(value);

export const formatHeaderCompactUsd = (value: number | null): string =>
  value === null ? DASH : formatCompactUsd(value);

export const formatHeaderSignedUsd = (value: number | null): string =>
  value === null ? DASH : formatSignedUsdFull(value);

export const formatHeaderSignedPercent = (value: number | null): string =>
  value === null ? DASH : formatSignedPercent(value);

export const formatHeaderFunding = (value: number | null): string =>
  value === null ? DASH : formatFundingPercent(value);

export interface MarketHeaderValues {
  readonly markPrice: number | null;
  readonly oraclePrice: number | null;
  readonly change24hAbs: number | null;
  readonly change24hPct: number | null;
  readonly volume24h: number | null;
  readonly openInterest: number | null;
  readonly fundingRate: number | null;
  readonly marketType: "perp" | "spot" | undefined;
  readonly marketCap: number | undefined;
  readonly contractAddress: string | undefined;
}

export interface MarketHeaderInput {
  readonly isSpot: boolean;
  readonly livePrice: number | null;
  readonly price: MarketPrice;
  readonly tradeAsset: AggregatedMarket | undefined;
  readonly ctx?: AssetCtxSnapshot | undefined;
}

export function deriveMarketHeaderValues({
  isSpot,
  livePrice,
  price,
  tradeAsset,
  ctx,
}: MarketHeaderInput): MarketHeaderValues {
  const quote = price.quote ?? null;
  const circulatingSupply = tradeAsset?.circulatingSupply;

  const spotPrevDayPx =
    isSpot && isNonEmpty(tradeAsset?.prevDayPx)
      ? positiveOrNull(Number(tradeAsset?.prevDayPx))
      : null;
  const prevDayPx = isSpot ? spotPrevDayPx : positiveOrNull(ctx?.prevDayPx ?? quote?.prevDayPx);

  const markPrice = isSpot
    ? finiteOrNull(livePrice)
    : (finiteOrNull(ctx?.markPx) ?? finiteOrNull(livePrice));

  const oraclePrice = isSpot
    ? null
    : (finiteOrNull(ctx?.oraclePx) ?? finiteOrNull(quote?.midPx) ?? finiteOrNull(quote?.markPx));

  const changePct =
    markPrice !== null && prevDayPx !== null ? ((markPrice - prevDayPx) / prevDayPx) * 100 : null;
  const changeAbs = markPrice !== null && prevDayPx !== null ? markPrice - prevDayPx : null;

  const spotVolume = isNonEmpty(tradeAsset?.dayNtlVlm)
    ? positiveOrNull(Number(tradeAsset?.dayNtlVlm))
    : null;
  const volume24h = isSpot
    ? (spotVolume ?? positiveOrNull(quote?.volume24h))
    : (positiveOrNull(ctx?.dayNtlVlm) ?? positiveOrNull(quote?.volume24h));

  const ctxOpenInterestUsd =
    ctx !== undefined && ctx.openInterest > 0 && ctx.markPx > 0
      ? ctx.openInterest * ctx.markPx
      : null;
  const quoteOpenInterest = positiveOrNull(quote?.openInterest);
  const quoteMarkPx = positiveOrNull(quote?.markPx);
  const restOpenInterestUsd =
    quoteOpenInterest !== null && quoteMarkPx !== null ? quoteOpenInterest * quoteMarkPx : null;
  const openInterest = isSpot ? null : (ctxOpenInterestUsd ?? restOpenInterestUsd);

  const rawFunding = finiteOrNull(ctx?.funding ?? quote?.funding);
  const fundingRate = isSpot || rawFunding === null ? null : rawFunding * 8;

  return {
    markPrice,
    oraclePrice,
    change24hAbs: changeAbs,
    change24hPct: changePct,
    volume24h,
    openInterest,
    fundingRate,
    marketType: tradeAsset?.marketType,
    marketCap:
      isSpot && isNonEmpty(circulatingSupply)
        ? (markPrice ?? 0) * Number(circulatingSupply)
        : undefined,
    contractAddress: isSpot ? contractAddressText(tradeAsset?.evmContract) : undefined,
  };
}
