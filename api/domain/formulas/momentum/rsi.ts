import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// RSI (Relative Strength Index) - Momentum Analysis
// ============================================================================
// Measures momentum and identifies overbought (>70) or oversold (<30) conditions
//
// Formula:
// RSI = 100 - (100 / (1 + RS))
// where RS = Average Gain / Average Loss
//
// Traditional RSI uses 14 periods, but we approximate using 24h data
// ============================================================================

export interface RSIResult {
  readonly rsi: number;
  readonly signal: "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT";
  readonly momentum: number; // -1 to 1
}

/**
 * Pure function to calculate RSI approximation from 24h price data
 * Uses a more balanced approach for single-period data
 */
export const calculateRSI = (
  currentPrice: number,
  change24h: number,
  ath: number | undefined,
  atl: number | undefined
): RSIResult => {
  // For 24h data, we use a linear mapping approach
  // This gives more balanced results than traditional RS calculation
  // -10% change = RSI 20, 0% = RSI 50, +10% = RSI 80

  // Base RSI from price change (scaled to be more moderate)
  // ±5% change maps to ±15 RSI points from 50
  let rsi = 50 + change24h * 3;

  // ATH/ATL context adjustment (if available)
  if (ath && atl && ath > atl) {
    const priceRange = ath - atl;
    const pricePosition = currentPrice - atl;
    const athAtlFactor = pricePosition / priceRange; // 0-1

    // Blend with ATH/ATL position (20% weight)
    const athAtlRsi = athAtlFactor * 100;
    rsi = rsi * 0.8 + athAtlRsi * 0.2;
  }

  // Clamp between 10-90 to avoid extreme values with limited data
  rsi = Math.max(10, Math.min(90, rsi));

  // Determine signal with moderate thresholds
  const signal: "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT" =
    rsi > 65 ? "OVERBOUGHT" : rsi < 35 ? "OVERSOLD" : "NEUTRAL";

  // Momentum: normalized -1 to 1
  const momentum = (rsi - 50) / 50;

  return {
    rsi: Math.round(rsi * 10) / 10,
    signal,
    momentum,
  };
};

/**
 * Effect-based wrapper for RSI calculation
 */
export const computeRSI = (price: CryptoPrice): Effect.Effect<RSIResult> =>
  Effect.sync(() => calculateRSI(price.price, price.change24h, price.ath, price.atl));

// ============================================================================
// RSI DIVERGENCE DETECTION
// ============================================================================
// Detects when price and momentum diverge, signaling potential reversal

export interface RSIDivergenceSignal {
  readonly symbol: string;
  readonly hasDivergence: boolean;
  readonly divergenceType: "BULLISH" | "BEARISH" | "NONE";
  readonly strength: number; // 0-100
  readonly rsi: number;
  readonly priceAction: "HIGHER_HIGH" | "LOWER_LOW" | "NEUTRAL";
}

/**
 * Pure function to detect RSI divergence
 *
 * Bullish Divergence: Price makes lower low, RSI makes higher low
 * Bearish Divergence: Price makes higher high, RSI makes lower high
 */
export const detectRSIDivergence = (price: CryptoPrice, rsi: RSIResult): RSIDivergenceSignal => {
  let priceAction: "HIGHER_HIGH" | "LOWER_LOW" | "NEUTRAL" = "NEUTRAL";
  let hasDivergence = false;
  let divergenceType: "BULLISH" | "BEARISH" | "NONE" = "NONE";
  let strength = 0;

  if (price.ath && price.atl) {
    const priceToATH = price.price / price.ath;
    const priceToATL = price.price / price.atl;

    // Near ATH (within 10%)
    if (priceToATH > 0.9) {
      priceAction = "HIGHER_HIGH";

      // Bearish divergence: price near ATH but RSI not overbought
      if (rsi.rsi < 70) {
        hasDivergence = true;
        divergenceType = "BEARISH";
        strength = Math.round((70 - rsi.rsi) * 2);
      }
    }
    // Near ATL (within 50% above)
    else if (priceToATL < 1.5) {
      priceAction = "LOWER_LOW";

      // Bullish divergence: price near ATL but RSI not oversold
      if (rsi.rsi > 30) {
        hasDivergence = true;
        divergenceType = "BULLISH";
        strength = Math.round((rsi.rsi - 30) * 2);
      }
    }
  }

  return {
    symbol: price.symbol,
    hasDivergence,
    divergenceType,
    strength: Math.min(strength, 100),
    rsi: rsi.rsi,
    priceAction,
  };
};

/**
 * Effect-based divergence detection
 */
export const detectDivergence = (price: CryptoPrice): Effect.Effect<RSIDivergenceSignal> =>
  Effect.gen(function* () {
    const rsi = yield* computeRSI(price);
    return yield* Effect.sync(() => detectRSIDivergence(price, rsi));
  });
