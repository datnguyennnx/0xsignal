/**
 * @hyperliquid-api POST /exchange (price/size rules)
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/exchange-endpoint
 */

import type { DecimalString, WirePx, WireSz } from "./brands";
import { countDecimals, countSignificantFigures, isIntegerString, normalize } from "./decimal";
import { ValidationError } from "./errors";
import { cast } from "./parse";

export const MAX_DECIMALS_PERP = 6;
export const MAX_DECIMALS_SPOT = 8;

const MAX_SIGNIFICANT_FIGURES = 5;
const MAX_EXACT_DIGITS = 15;
const decimalPattern = /^-?\d+(\.\d+)?$/;

const maxDecimals = (kind: "perp" | "spot"): number =>
  kind === "perp" ? MAX_DECIMALS_PERP : MAX_DECIMALS_SPOT;

const toDecimalString = (raw: DecimalString | number): string => {
  const s = typeof raw === "number" ? String(raw) : raw;
  if (!decimalPattern.test(s)) {
    throw new ValidationError(`value "${s}"`, "plain decimal string without exponent");
  }
  if (typeof raw === "number" && countSignificantFigures(s) > MAX_EXACT_DIGITS) {
    throw new ValidationError(`value "${s}"`, "exact decimal representation of a number");
  }
  return s;
};

const priceRule = (szDecimals: number, kind: "perp" | "spot"): string =>
  `at most 5 significant figures and at most ${maxDecimals(kind) - szDecimals} decimal places (${kind}, szDecimals ${szDecimals})`;

const sizeRule = (szDecimals: number): string => `at most ${szDecimals} decimal places`;

export const isValidPrice = (raw: string, szDecimals: number, kind: "perp" | "spot"): boolean => {
  if (!decimalPattern.test(raw) || !Number.isInteger(szDecimals) || szDecimals < 0) return false;
  const limit = maxDecimals(kind) - szDecimals;
  if (countDecimals(raw) > limit) return false;
  if (isIntegerString(raw)) return true;
  return countSignificantFigures(raw) <= MAX_SIGNIFICANT_FIGURES;
};

export const isValidSize = (raw: string, szDecimals: number): boolean => {
  if (!decimalPattern.test(raw) || !Number.isInteger(szDecimals) || szDecimals < 0) return false;
  return countDecimals(raw) <= szDecimals;
};

export const toWirePrice = (
  raw: DecimalString | number,
  szDecimals: number,
  kind: "perp" | "spot",
): WirePx => {
  const s = toDecimalString(raw);
  if (!isValidPrice(s, szDecimals, kind)) {
    const rule =
      !isIntegerString(s) && countSignificantFigures(s) > MAX_SIGNIFICANT_FIGURES
        ? `${priceRule(szDecimals, kind)}; 5 significant figures exceeded`
        : priceRule(szDecimals, kind);
    throw new ValidationError(`price "${s}"`, rule);
  }
  return cast<WirePx>(normalize(s), "price");
};

export const toWireSize = (raw: DecimalString | number, szDecimals: number): WireSz => {
  const s = toDecimalString(raw);
  if (!isValidSize(s, szDecimals)) {
    throw new ValidationError(`size "${s}"`, sizeRule(szDecimals));
  }
  return cast<WireSz>(normalize(s), "size");
};
