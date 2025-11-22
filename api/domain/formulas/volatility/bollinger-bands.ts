import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// BOLLINGER BANDS - Volatility Analysis
// ============================================================================
// Measures market volatility and identifies overbought/oversold conditions
// by calculating standard deviation bands around a moving average
//
// Formula:
// - Middle Band = SMA (Simple Moving Average)
// - Upper Band = SMA + (k × σ)
// - Lower Band = SMA - (k × σ)
// where k = 2 (standard), σ = standard deviation
// ============================================================================

export interface BollingerBandsResult {
  readonly upperBand: number;
  readonly middleBand: number;
  readonly lowerBand: number;
  readonly bandwidth: number; // Measures volatility
  readonly percentB: number; // Position within bands (0-1)
}

/**
 * Pure function to calculate Bollinger Bands
 * For 24h data, we approximate using high/low/current price
 */
export const calculateBollingerBands = (
  currentPrice: number,
  high24h: number | undefined,
  low24h: number | undefined
): BollingerBandsResult => {
  if (!high24h || !low24h) {
    return {
      upperBand: currentPrice * 1.1,
      middleBand: currentPrice,
      lowerBand: currentPrice * 0.9,
      bandwidth: 0.2,
      percentB: 0.5,
    };
  }

  // Approximate SMA using 24h data
  const middleBand = (high24h + low24h + currentPrice) / 3;
  
  // Calculate standard deviation approximation
  const variance = 
    Math.pow(high24h - middleBand, 2) +
    Math.pow(low24h - middleBand, 2) +
    Math.pow(currentPrice - middleBand, 2);
  const stdDev = Math.sqrt(variance / 3);
  
  // Bollinger Bands with k=2
  const upperBand = middleBand + (2 * stdDev);
  const lowerBand = middleBand - (2 * stdDev);
  
  // Bandwidth: measures volatility (higher = more volatile)
  const bandwidth = (upperBand - lowerBand) / middleBand;
  
  // %B: position within bands (>1 = above upper, <0 = below lower)
  const percentB = (currentPrice - lowerBand) / (upperBand - lowerBand);
  
  return {
    upperBand,
    middleBand,
    lowerBand,
    bandwidth,
    percentB,
  };
};

/**
 * Effect-based wrapper for Bollinger Bands calculation
 */
export const computeBollingerBands = (
  price: CryptoPrice
): Effect.Effect<BollingerBandsResult> =>
  Effect.sync(() => 
    calculateBollingerBands(price.price, price.high24h, price.low24h)
  );

// ============================================================================
// BOLLINGER BAND SQUEEZE DETECTION
// ============================================================================
// Detects periods of low volatility that often precede large moves

export interface BollingerSqueezeSignal {
  readonly symbol: string;
  readonly isSqueezing: boolean;
  readonly bandwidth: number;
  readonly squeezeIntensity: number; // 0-100
  readonly breakoutDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  readonly confidence: number;
}

/**
 * Pure function to detect Bollinger Band squeeze
 * Squeeze occurs when bandwidth < 0.1 (10% of price)
 */
export const detectBollingerSqueeze = (
  price: CryptoPrice,
  bb: BollingerBandsResult
): BollingerSqueezeSignal => {
  const squeezeThreshold = 0.1;
  const isSqueezing = bb.bandwidth < squeezeThreshold;
  
  // Squeeze intensity: how tight the bands are (0-100)
  const squeezeIntensity = isSqueezing
    ? Math.round((1 - bb.bandwidth / squeezeThreshold) * 100)
    : 0;
  
  // Determine breakout direction using %B position
  let breakoutDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;
  
  if (isSqueezing) {
    if (bb.percentB > 0.6) {
      breakoutDirection = 'BULLISH';
      confidence = 60 + Math.round((bb.percentB - 0.6) * 100);
    } else if (bb.percentB < 0.4) {
      breakoutDirection = 'BEARISH';
      confidence = 60 + Math.round((0.4 - bb.percentB) * 100);
    }
  }
  
  return {
    symbol: price.symbol,
    isSqueezing,
    bandwidth: bb.bandwidth,
    squeezeIntensity,
    breakoutDirection,
    confidence: Math.min(confidence, 100),
  };
};

/**
 * Effect-based squeeze detection
 */
export const detectSqueeze = (
  price: CryptoPrice
): Effect.Effect<BollingerSqueezeSignal> =>
  Effect.gen(function* () {
    const bb = yield* computeBollingerBands(price);
    return yield* Effect.sync(() => detectBollingerSqueeze(price, bb));
  });
