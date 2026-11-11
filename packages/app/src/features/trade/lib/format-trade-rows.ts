import {
  formatCompactUsd,
  formatFundingPercent,
  formatMarketPrice,
  formatMarketUsdFull,
  formatPrice,
  formatSignedAbs,
  formatSignedPercent,
  formatSize,
} from "@/core/utils/formatters";
import type { AssetCtxSnapshot } from "./asset-ctx";
import type { MarketRowData } from "./market-row-data";

export type MarketCellField =
  | "symbol"
  | "price"
  | "change"
  | "funding"
  | "volume"
  | "oi"
  | "marketCap";

const MARKET_CELL_FIELDS: readonly MarketCellField[] = ["symbol", "marketCap"];

const CACHED_FIELDS: ReadonlySet<MarketCellField> = new Set(MARKET_CELL_FIELDS);

/** A snapshot version bounds the cache: a new snapshot cannot reuse its strings. */
const CACHE_LIMIT = 4000;
const cellCache = new Map<string, string>();

const computeCell = (row: MarketRowData, field: MarketCellField): string => {
  switch (field) {
    case "symbol":
      return row.displaySymbol;
    case "price":
      return formatPrice(row.markPx, row.pxDecimals);
    case "change":
      return formatSignedPercent(row.changePct);
    case "funding":
      return formatFundingPercent(row.funding);
    case "volume":
      return formatCompactUsd(row.volumeUsd);
    case "oi":
      return formatSize(row.openInterest);
    case "marketCap":
      return row.marketCapUsd > 0 ? formatCompactUsd(row.marketCapUsd) : "--";
    default:
      return "";
  }
};

export function formatMarketCell(
  row: MarketRowData,
  field: MarketCellField,
  version: number,
): string {
  if (!CACHED_FIELDS.has(field)) return computeCell(row, field);

  const cacheKey = `${row.key}:${field}:${version}`;
  const cached = cellCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const value = computeCell(row, field);
  if (cellCache.size >= CACHE_LIMIT) cellCache.clear();
  cellCache.set(cacheKey, value);
  return value;
}

export interface LiveCells {
  readonly price: string;
  readonly change: string;
  readonly funding: string;
  readonly volume: string;
  readonly openInterest: string;
}

const DASH = "--";

export function computeLiveCells(input: {
  row: MarketRowData;
  ctx: AssetCtxSnapshot | undefined;
  midPx: number | undefined;
}): LiveCells {
  const { row, ctx, midPx } = input;
  const price = midPx ?? ctx?.markPx ?? row.markPx;
  const prevDayPx = ctx?.prevDayPx ?? row.prevDayPx;
  const changePct =
    Number.isFinite(price) && Number.isFinite(prevDayPx) && prevDayPx > 0
      ? ((price - prevDayPx) / prevDayPx) * 100
      : null;
  const isSpot = row.marketType === "spot";
  const fundingRate8h = (ctx?.funding ?? row.funding) * 8;
  const volumeUsd = ctx?.dayNtlVlm ?? row.volumeUsd;
  const markForOi = ctx?.markPx ?? row.markPx;
  const openInterestUsd = (ctx?.openInterest ?? row.openInterest) * markForOi;

  return {
    price: formatMarketPrice(price, row.pxDecimals),
    change:
      changePct === null
        ? "—"
        : `${formatSignedAbs(price - prevDayPx, row.pxDecimals)} / ${formatSignedPercent(changePct)}`,
    funding: isSpot ? DASH : formatFundingPercent(fundingRate8h),
    volume: formatMarketUsdFull(volumeUsd),
    openInterest: isSpot ? DASH : formatMarketUsdFull(openInterestUsd),
  };
}

/** Warms the next screen of rows while the browser is idle after the panel opens. */
export function prewarmMarketCells(
  rows: readonly MarketRowData[],
  version: number,
  count = 40,
): void {
  const limit = Math.min(count, rows.length);
  for (let index = 0; index < limit; index += 1) {
    for (const field of MARKET_CELL_FIELDS) {
      formatMarketCell(rows[index], field, version);
    }
  }
}
