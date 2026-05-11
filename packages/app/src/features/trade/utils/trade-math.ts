/**
 * @overview Pure trading math utilities for Hyperliquid order forms.
 *
 * All functions are side-effect free — no React, no UI, no hooks.
 * Formulas assume ROE (Return on Equity) basis where leverage scales
 * the percentage gain/loss relative to the entry price.
 *
 * @module trade-math
 */

/**
 * Buffer applied to max size to account for taker fees.
 * Prevents orders from being rejected due to insufficient margin
 * after fee deduction.
 */
export const MARGIN_BUFFER = 0.985;

/**
 * Calculate the take-profit price from a desired gain percent (ROE-based).
 *
 * @param entryPrice - The position entry price
 * @param gainPercent - Desired gain as a percentage (e.g., 5 for 5%)
 * @param leverage - Position leverage multiplier
 * @param isLong - True for long positions, false for short
 * @returns The TP price
 *
 * @example
 * tpPriceFromPercent(100, 10, 2, true)  // → 105 (10% gain with 2x leverage = 5% price move)
 * tpPriceFromPercent(100, 10, 2, false) // → 95
 */
export function tpPriceFromPercent(
  entryPrice: number,
  gainPercent: number,
  leverage: number,
  isLong: boolean
): number {
  const factor = gainPercent / 100 / leverage;
  return isLong ? entryPrice * (1 + factor) : entryPrice * (1 - factor);
}

/**
 * Calculate the stop-loss price from a desired loss percent (ROE-based).
 *
 * @param entryPrice - The position entry price
 * @param lossPercent - Maximum acceptable loss as a percentage (e.g., 5 for 5%)
 * @param leverage - Position leverage multiplier
 * @param isLong - True for long positions, false for short
 * @returns The SL price
 *
 * @example
 * slPriceFromPercent(100, 5, 2, true)  // → 97.5
 * slPriceFromPercent(100, 5, 2, false) // → 102.5
 */
export function slPriceFromPercent(
  entryPrice: number,
  lossPercent: number,
  leverage: number,
  isLong: boolean
): number {
  const factor = lossPercent / 100 / leverage;
  return isLong ? entryPrice * (1 - factor) : entryPrice * (1 + factor);
}

/**
 * Calculate the realized gain percent from a take-profit price (ROE-based).
 *
 * @param entryPrice - The position entry price
 * @param tpPrice - The take-profit price
 * @param leverage - Position leverage multiplier
 * @param isLong - True for long positions, false for short
 * @returns The gain percentage (positive value)
 *
 * @example
 * gainPercentFromPrice(100, 105, 2, true)  // → 10
 * gainPercentFromPrice(100, 95, 2, false)  // → 10
 */
export function gainPercentFromPrice(
  entryPrice: number,
  tpPrice: number,
  leverage: number,
  isLong: boolean
): number {
  const diff = isLong ? tpPrice - entryPrice : entryPrice - tpPrice;
  return (diff / entryPrice) * leverage * 100;
}

/**
 * Calculate the realized loss percent from a stop-loss price (ROE-based).
 * Always returns a positive value representing the magnitude of the loss.
 *
 * @param entryPrice - The position entry price
 * @param slPrice - The stop-loss price
 * @param leverage - Position leverage multiplier
 * @param isLong - True for long positions, false for short
 * @returns The loss percentage (positive magnitude)
 *
 * @example
 * lossPercentFromPrice(100, 97.5, 2, true)  // → 5
 * lossPercentFromPrice(100, 102.5, 2, false) // → 5
 */
export function lossPercentFromPrice(
  entryPrice: number,
  slPrice: number,
  leverage: number,
  isLong: boolean
): number {
  const diff = isLong ? entryPrice - slPrice : slPrice - entryPrice;
  return (diff / entryPrice) * leverage * 100;
}

/**
 * Format an order size string by **truncating** (floor) to the specified
 * number of decimal places. This intentionally does NOT round half-up,
 * preventing the formatted size from exceeding the available margin.
 *
 * @param size - The raw size value
 * @param szDecimals - Number of decimal places to truncate to
 * @returns Formatted size string (e.g., "1.234")
 *
 * @example
 * formatOrderSize(1.23456, 3) // → "1.234"
 * formatOrderSize(1.23456, 2) // → "1.23"
 * formatOrderSize(0, 2)       // → "0"
 */
export function formatOrderSize(size: number, szDecimals: number): string {
  if (!Number.isFinite(size) || size <= 0) return "0";
  const factor = Math.pow(10, szDecimals);
  const truncated = Math.floor(size * factor) / factor;
  return truncated.toFixed(szDecimals);
}

/**
 * Format a price value to 2 decimal places. Returns an empty string for
 * invalid or non-positive values.
 *
 * @param value - The price value
 * @returns Formatted price string (e.g., "105.00") or ""
 *
 * @example
 * fmtPrice(105.5)  // → "105.50"
 * fmtPrice(0)      // → ""
 * fmtPrice(NaN)    // → ""
 */
export function fmtPrice(value: number): string {
  return Number.isFinite(value) && value > 0 ? value.toFixed(2) : "";
}

/**
 * Format a percentage value to 2 decimal places. Returns an empty string
 * for invalid or negative values.
 *
 * @param value - The percentage value
 * @returns Formatted percentage string (e.g., "10.00") or ""
 *
 * @example
 * fmtPct(10.5)  // → "10.50"
 * fmtPct(-1)    // → ""
 * fmtPct(NaN)   // → ""
 */
export function fmtPct(value: number): string {
  return Number.isFinite(value) && value >= 0 ? value.toFixed(2) : "";
}

/**
 * Calculate order size (in USDC) from a percentage of max notional.
 * Pure version — no component state dependencies.
 *
 * @param pct - Percentage of max notional (0–100)
 * @param maxNotional - Maximum notional value (available balance × leverage)
 * @returns Formatted size string (e.g., "500.00")
 *
 * @example
 * sizeFromPct(50, 1000) // → "500.00"
 * sizeFromPct(0, 1000)  // → "0.00"
 * sizeFromPct(-10, 1000) // → "0.00"
 */
export function sizeFromPct(pct: number, maxNotional: number): string {
  return pct <= 0 ? "0.00" : ((maxNotional * pct) / 100).toFixed(2);
}
