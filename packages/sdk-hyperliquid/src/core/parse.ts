/**
 * @hyperliquid-api (core) POST /info, POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import type { Address, DecimalString, Hash32, Hex } from "./brands";
import { ValidationError } from "./errors";

const decimalPattern = /^-?\d+(\.\d+)?$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hash32Pattern = /^0x[0-9a-fA-F]{64}$/;
const hexPattern = /^0x[0-9a-fA-F]*$/;
const bigintPattern = /^-?\d+$/;

export function cast<T>(u: unknown, path: string): T {
  if (u === undefined) throw new ValidationError(path, "defined");
  return u as T;
}

export const obj = (u: unknown, path: string): Record<string, unknown> => {
  if (typeof u !== "object" || u === null || Array.isArray(u)) {
    throw new ValidationError(path, "object");
  }
  return u as Record<string, unknown>;
};

export const arr = (u: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(u)) throw new ValidationError(path, "array");
  return u;
};

export const str = (u: unknown, path: string): string => {
  if (typeof u !== "string") throw new ValidationError(path, "string");
  return u;
};

export const num = (u: unknown, path: string): number => {
  if (typeof u !== "number" || !Number.isFinite(u))
    throw new ValidationError(path, "finite number");
  return u;
};

export const bool = (u: unknown, path: string): boolean => {
  if (typeof u !== "boolean") throw new ValidationError(path, "boolean");
  return u;
};

export const nullable =
  <T>(parse: (u: unknown, path: string) => T) =>
  (u: unknown, path: string): T | null =>
    u === null ? null : parse(u, path);

export const oneOf = <const T extends string>(values: readonly T[]) => {
  const set: ReadonlySet<string> = new Set(values);
  return (u: unknown, path: string): T => {
    const s = str(u, path);
    if (!set.has(s)) throw new ValidationError(path, values.join(" | "));
    return s as T;
  };
};

export const decimal = (u: unknown, path: string): DecimalString => {
  const s = str(u, path);
  if (!decimalPattern.test(s)) throw new ValidationError(path, "decimal string");
  return s as DecimalString;
};

export const address = (u: unknown, path: string): Address => {
  const s = str(u, path);
  if (!addressPattern.test(s)) throw new ValidationError(path, "0x-prefixed 40 hex characters");
  return s as Address;
};

export const hash32 = (u: unknown, path: string): Hash32 => {
  const s = str(u, path);
  if (!hash32Pattern.test(s)) throw new ValidationError(path, "0x-prefixed 64 hex characters");
  return s as Hash32;
};

export const hex = (u: unknown, path: string): Hex => {
  const s = str(u, path);
  if (!hexPattern.test(s)) throw new ValidationError(path, "0x-prefixed hex string");
  return s as Hex;
};

export const bigintStr = (u: unknown, path: string): bigint => {
  const s = str(u, path);
  if (!bigintPattern.test(s)) throw new ValidationError(path, "integer string");
  return BigInt(s);
};
