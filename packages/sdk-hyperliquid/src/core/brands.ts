/**
 * @hyperliquid-api (core) POST /info, POST /exchange
 * @docs https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api
 */

import { ValidationError } from "./errors";
import { cast } from "./parse";

declare const addressSymbol: unique symbol;
declare const hexSymbol: unique symbol;
declare const hash32Symbol: unique symbol;
declare const decimalSymbol: unique symbol;
declare const cloidSymbol: unique symbol;
declare const weiSymbol: unique symbol;
declare const bpsSymbol: unique symbol;
declare const assetIdSymbol: unique symbol;
declare const nonceSymbol: unique symbol;
declare const pxSymbol: unique symbol;
declare const szSymbol: unique symbol;
declare const wirePxSymbol: unique symbol;
declare const wireSzSymbol: unique symbol;

export type Address = string & { readonly __brand: typeof addressSymbol };
export type Hex = string & { readonly __brand: typeof hexSymbol };
export type Hash32 = string & { readonly __brand: typeof hash32Symbol };
export type DecimalString = string & { readonly __brand: typeof decimalSymbol };
export type Cloid = string & { readonly __brand: typeof cloidSymbol };
export type Wei = bigint & { readonly __brand: typeof weiSymbol };
export type Bps = number & { readonly __brand: typeof bpsSymbol };
export type AssetId = number & { readonly __brand: typeof assetIdSymbol };
export type Nonce = bigint & { readonly __brand: typeof nonceSymbol };
export type Px = string & { readonly __brand: typeof pxSymbol };
export type Sz = string & { readonly __brand: typeof szSymbol };
export type WirePx = string & { readonly __brand: typeof wirePxSymbol };
export type WireSz = string & { readonly __brand: typeof wireSzSymbol };

const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const hexPattern = /^0x[0-9a-fA-F]*$/;
const hash32Pattern = /^0x[0-9a-fA-F]{64}$/;
const decimalPattern = /^-?\d+(\.\d+)?$/;
const cloidPattern = /^0x[0-9a-fA-F]{32}$/;

const isAddress = (u: string): u is Address => addressPattern.test(u);
const isHex = (u: string): u is Hex => hexPattern.test(u);
const isHash32 = (u: string): u is Hash32 => hash32Pattern.test(u);
const isDecimal = (u: string): u is DecimalString => decimalPattern.test(u);
const isCloid = (u: string): u is Cloid => cloidPattern.test(u);

export const asAddress = (u: string): Address => {
  if (!isAddress(u)) throw new ValidationError("address", "0x-prefixed 40 hex characters");
  return u;
};

export const asHex = (u: string): Hex => {
  if (!isHex(u)) throw new ValidationError("hex", "0x-prefixed hex string");
  return u;
};

export const asHash32 = (u: string): Hash32 => {
  if (!isHash32(u)) throw new ValidationError("hash32", "0x-prefixed 64 hex characters");
  return u;
};

export const asDecimal = (u: string): DecimalString => {
  if (!isDecimal(u)) throw new ValidationError("decimal", "decimal string");
  return u;
};

export const asCloid = (u: string): Cloid => {
  if (!isCloid(u)) throw new ValidationError("cloid", "0x-prefixed 32 hex characters");
  return u;
};

export const asAssetId = (u: number): AssetId => {
  if (!Number.isInteger(u) || u < 0) throw new ValidationError("assetId", "non-negative integer");
  return u as AssetId;
};

export const asNonce = (u: bigint): Nonce => {
  if (u < 0n) throw new ValidationError("nonce", "non-negative bigint");
  return u as Nonce;
};

export const asPx = (u: string): Px => {
  if (!decimalPattern.test(u)) throw new ValidationError("px", "decimal string");
  return cast<Px>(u, "px");
};

export const asSz = (u: string): Sz => {
  if (!decimalPattern.test(u)) throw new ValidationError("sz", "decimal string");
  return cast<Sz>(u, "sz");
};
