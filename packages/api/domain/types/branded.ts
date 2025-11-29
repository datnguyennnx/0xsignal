/**
 * Branded Types
 * Type-safe primitives for domain modeling
 */

import { Brand } from "effect";

// Symbol identifier (e.g., "btc", "eth")
export type SymbolId = string & Brand.Brand<"SymbolId">;
export const SymbolId = Brand.nominal<SymbolId>();

// Price value (positive number)
export type Price = number & Brand.Brand<"Price">;
export const Price = Brand.refined<Price>(
  (n) => n >= 0,
  (n) => Brand.error(`Price must be non-negative, got ${n}`)
);

// Percentage value (-100 to 100+)
export type Percentage = number & Brand.Brand<"Percentage">;
export const Percentage = Brand.nominal<Percentage>();

// Confidence score (0-100)
export type Confidence = number & Brand.Brand<"Confidence">;
export const Confidence = Brand.refined<Confidence>(
  (n) => n >= 0 && n <= 100,
  (n) => Brand.error(`Confidence must be 0-100, got ${n}`)
);

// Risk score (0-100)
export type RiskScore = number & Brand.Brand<"RiskScore">;
export const RiskScore = Brand.refined<RiskScore>(
  (n) => n >= 0 && n <= 100,
  (n) => Brand.error(`RiskScore must be 0-100, got ${n}`)
);

// RSI value (0-100)
export type RSIValue = number & Brand.Brand<"RSIValue">;
export const RSIValue = Brand.refined<RSIValue>(
  (n) => n >= 0 && n <= 100,
  (n) => Brand.error(`RSI must be 0-100, got ${n}`)
);

// Normalized ATR (typically 0-10+)
export type NormalizedATR = number & Brand.Brand<"NormalizedATR">;
export const NormalizedATR = Brand.refined<NormalizedATR>(
  (n) => n >= 0,
  (n) => Brand.error(`NormalizedATR must be non-negative, got ${n}`)
);

// Market cap (positive number)
export type MarketCap = number & Brand.Brand<"MarketCap">;
export const MarketCap = Brand.refined<MarketCap>(
  (n) => n >= 0,
  (n) => Brand.error(`MarketCap must be non-negative, got ${n}`)
);

// Volume (positive number)
export type Volume = number & Brand.Brand<"Volume">;
export const Volume = Brand.refined<Volume>(
  (n) => n >= 0,
  (n) => Brand.error(`Volume must be non-negative, got ${n}`)
);

// Helper to safely create branded types
export const safeBrand = <A extends Brand.Brand<any>>(
  brand: Brand.Brand.Constructor<A>,
  value: Brand.Brand.Unbranded<A>
): A | null => {
  try {
    return brand(value);
  } catch {
    return null;
  }
};
