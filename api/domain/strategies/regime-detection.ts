// ============================================================================
// REGIME DETECTION - PURE FUNCTIONS
// ============================================================================
// Detects current market regime to select appropriate strategies
// Pure functional approach - no side effects
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { MarketRegime } from "./types";
import { calculateRSI } from "../formulas/momentum/rsi";
import { calculateBollingerBands } from "../formulas/volatility/bollinger-bands";

/**
 * Pure function to detect market regime
 * Combines multiple indicators to classify market state
 */
export const detectRegime = (price: CryptoPrice): MarketRegime => {
  const rsi = calculateRSI(price.price, price.change24h, price.ath, price.atl);
  const bb = calculateBollingerBands(price.price, price.high24h, price.low24h);

  // Calculate volatility
  const volatility =
    price.high24h && price.low24h ? ((price.high24h - price.low24h) / price.price) * 100 : 0;

  // Detect low volatility (Bollinger Squeeze)
  if (bb.bandwidth < 0.1) {
    return "LOW_VOLATILITY";
  }

  // Detect high volatility
  if (volatility > 10 || bb.bandwidth > 0.3) {
    return "HIGH_VOLATILITY";
  }

  // Detect mean reversion opportunities
  if (bb.percentB > 0.9 || bb.percentB < 0.1) {
    return "MEAN_REVERSION";
  }

  // Detect trending markets
  const strongTrend = Math.abs(rsi.rsi - 50) > 20;
  if (strongTrend) {
    // Bull market: RSI > 50 and positive price change
    if (rsi.rsi > 50 && price.change24h > 0) {
      return "BULL_MARKET";
    }
    // Bear market: RSI < 50 and negative price change
    if (rsi.rsi < 50 && price.change24h < 0) {
      return "BEAR_MARKET";
    }
    return "TRENDING";
  }

  // Default to sideways
  return "SIDEWAYS";
};

/**
 * Effect-based regime detection
 */
export const detectMarketRegime = (price: CryptoPrice): Effect.Effect<MarketRegime, never> =>
  Effect.sync(() => detectRegime(price));
