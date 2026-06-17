import { getNextFundingMs } from "@/core/utils/formatters";

const FUNDING_INTERVAL_MS = 3_600_000;

/**
 * Compute accrued funding for an open position.
 * Positive funding rate → longs pay (−), shorts receive (+).
 */
export function computeAccruedFunding(
  settledFunding: number,
  positionValue: number,
  fundingRate: number | undefined,
  isLong: boolean,
): number {
  if (!fundingRate || !Number.isFinite(fundingRate)) return settledFunding;
  const msToNext = getNextFundingMs();
  const elapsedMs = FUNDING_INTERVAL_MS - Math.min(msToNext, FUNDING_INTERVAL_MS);
  const elapsedFraction = elapsedMs / FUNDING_INTERVAL_MS;
  const signAdj = isLong ? -1 : 1;
  const unsettled = positionValue * fundingRate * elapsedFraction * signAdj;
  return settledFunding + unsettled;
}

/**
 * Buffer applied to max size to account for taker fees.
 * Prevents orders from being rejected due to insufficient margin
 * after fee deduction.
 */
export const MARGIN_BUFFER = 0.985;

/**
 * Take-profit price from ROE-based gain percent.
 * @example tpPriceFromPercent(100, 10, 2, true)  // → 105
 */
export function tpPriceFromPercent(
  entryPrice: number,
  gainPercent: number,
  leverage: number,
  isLong: boolean,
): number {
  const factor = gainPercent / 100 / leverage;
  return isLong ? entryPrice * (1 + factor) : entryPrice * (1 - factor);
}

/**
 * Stop-loss price from ROE-based loss percent.
 * @example slPriceFromPercent(100, 5, 2, true)  // → 97.5
 */
export function slPriceFromPercent(
  entryPrice: number,
  lossPercent: number,
  leverage: number,
  isLong: boolean,
): number {
  const factor = lossPercent / 100 / leverage;
  return isLong ? entryPrice * (1 - factor) : entryPrice * (1 + factor);
}

/**
 * Realized gain percent from a take-profit price (ROE-based).
 * @example gainPercentFromPrice(100, 105, 2, true)  // → 10
 */
export function gainPercentFromPrice(
  entryPrice: number,
  tpPrice: number,
  leverage: number,
  isLong: boolean,
): number {
  const diff = isLong ? tpPrice - entryPrice : entryPrice - tpPrice;
  return (diff / entryPrice) * leverage * 100;
}

/**
 * Realized loss percent from a stop-loss price (ROE-based). Always positive.
 * @example lossPercentFromPrice(100, 97.5, 2, true)  // → 5
 */
export function lossPercentFromPrice(
  entryPrice: number,
  slPrice: number,
  leverage: number,
  isLong: boolean,
): number {
  const diff = isLong ? entryPrice - slPrice : slPrice - entryPrice;
  return (diff / entryPrice) * leverage * 100;
}

/**
 * Format order size by **truncating** (floor) to prevent exceeding available margin.
 * Does NOT round half-up.
 * @example formatOrderSize(1.23456, 3) // → "1.234"
 */
export function formatOrderSize(size: number, szDecimals: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0";
  const factor = Math.pow(10, szDecimals);
  const truncated = Math.floor(size * factor) / factor;
  return truncated.toFixed(szDecimals);
}

export function formatPriceFixed(value: number): string {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : "";
}

export function formatPctFixed(value: number): string {
  return Number.isFinite(value) && value >= 0 ? value.toFixed(2) : "";
}

export function buildFundingRatesMap(
  meta:
    | readonly { readonly marketType: string; readonly funding: string; readonly coin: string }[]
    | undefined,
): Record<string, number> {
  if (!meta) return {};
  const map: Record<string, number> = {};
  for (const market of meta) {
    if (market.marketType !== "perp") continue;
    const rate = Number(market.funding);
    if (Number.isFinite(rate) && rate !== 0) {
      map[market.coin.toUpperCase()] = rate;
    }
  }
  return map;
}
