/**
 * @hyperliquid-api (core) POST /info, POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import type { DecimalString } from "./brands";
import { ValidationError } from "./errors";

type DecimalParts = { readonly negative: boolean; readonly int: string; readonly frac: string };
type Scaled = { readonly value: bigint; readonly scale: number };

const split = (s: string): DecimalParts => {
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  const dot = body.indexOf(".");
  return {
    negative,
    int: dot === -1 ? body : body.slice(0, dot),
    frac: dot === -1 ? "" : body.slice(dot + 1),
  };
};

const toScaled = (s: string): Scaled => {
  const { negative, int, frac } = split(s);
  const digits = `${int}${frac}`.replace(/^0+(?=\d)/, "");
  return { value: BigInt(digits) * (negative ? -1n : 1n), scale: frac.length };
};

const fromScaled = (value: bigint, scale: number): string => {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(scale + 1, "0");
  const int = digits.slice(0, digits.length - scale);
  const frac = digits.slice(digits.length - scale);
  return `${negative ? "-" : ""}${scale === 0 ? int : `${int}.${frac}`}`;
};

const roundHalfUp = (value: bigint, shift: number): bigint => {
  const divisor = 10n ** BigInt(shift);
  const quotient = value / divisor;
  const remainder = value % divisor;
  const magnitude = remainder < 0n ? -remainder : remainder;
  if (magnitude * 2n < divisor) return quotient;
  return quotient + (value < 0n ? -1n : 1n);
};

export const normalize = (s: string): string => {
  const { negative, int, frac } = split(s);
  const trimmed = frac.replace(/0+$/, "");
  const magnitude = `${int.replace(/^0+(?=\d)/, "")}${trimmed === "" ? "" : `.${trimmed}`}`;
  return negative && magnitude !== "0" ? `-${magnitude}` : magnitude;
};

export const countDecimals = (s: string): number => split(normalize(s)).frac.length;

export const isIntegerString = (s: string): boolean => split(normalize(s)).frac === "";

export const countSignificantFigures = (s: string): number => {
  const { int, frac } = split(normalize(s));
  const digits = frac === "" ? int.replace(/0+$/, "") : `${int}${frac}`;
  return digits.replace(/^0+/, "").length;
};

export const toWire = (s: DecimalString): string => {
  const original = toScaled(s);
  const rounded =
    original.scale <= 8
      ? original.value * 10n ** BigInt(8 - original.scale)
      : roundHalfUp(original.value, original.scale - 8);
  const scale = Math.max(8, original.scale);
  const roundedAtScale = rounded * 10n ** BigInt(scale - 8);
  const originalAtScale = original.value * 10n ** BigInt(scale - original.scale);
  const diff = roundedAtScale - originalAtScale;
  if ((diff < 0n ? -diff : diff) * 10n ** 12n >= 10n ** BigInt(scale)) {
    throw new ValidationError("toWire", "at most 8 decimal places");
  }
  return normalize(fromScaled(rounded, 8));
};

export const compareDecimal = (left: DecimalString, right: DecimalString): -1 | 0 | 1 => {
  const x = toScaled(left);
  const y = toScaled(right);
  const scale = Math.max(x.scale, y.scale);
  const xv = x.value * 10n ** BigInt(scale - x.scale);
  const yv = y.value * 10n ** BigInt(scale - y.scale);
  return xv < yv ? -1 : xv > yv ? 1 : 0;
};

export const addDecimal = (left: DecimalString, right: DecimalString): string => {
  const x = toScaled(left);
  const y = toScaled(right);
  const scale = Math.max(x.scale, y.scale);
  const value = x.value * 10n ** BigInt(scale - x.scale) + y.value * 10n ** BigInt(scale - y.scale);
  return normalize(fromScaled(value, scale));
};

export const mulDecimal = (left: DecimalString, right: DecimalString): string => {
  const x = toScaled(left);
  const y = toScaled(right);
  return normalize(fromScaled(x.value * y.value, x.scale + y.scale));
};

export const isTickAligned = (price: DecimalString, tickSize: DecimalString): boolean => {
  const priceParts = toScaled(price);
  const tickParts = toScaled(tickSize);
  if (tickParts.value === 0n) return false;
  const scale = Math.max(priceParts.scale, tickParts.scale);
  const priceValue = priceParts.value * 10n ** BigInt(scale - priceParts.scale);
  const tickValue = tickParts.value * 10n ** BigInt(scale - tickParts.scale);
  return priceValue % tickValue === 0n;
};
