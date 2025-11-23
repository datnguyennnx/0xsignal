// ============================================================================
// MARKET CRASH DETECTION USE CASE
// ============================================================================
// Detects when market is going to hell - extreme bearish conditions
// Combines multiple indicators to identify crash scenarios
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { computeRSI } from "../../domain/formulas/momentum/rsi";
import { computeATR } from "../../domain/formulas/volatility/atr";
import { computeVolumeROC } from "../../domain/formulas/volume/volume-roc";
import { computeMaximumDrawdown } from "../../domain/formulas/risk/maximum-drawdown";

export interface CrashSignal {
  readonly isCrashing: boolean;
  readonly severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  readonly confidence: number;
  readonly indicators: {
    readonly rapidDrop: boolean;
    readonly volumeSpike: boolean;
    readonly oversoldExtreme: boolean;
    readonly highVolatility: boolean;
  };
  readonly recommendation: string;
}

/**
 * Detect market crash conditions
 * When to apply: Protect capital during extreme downturns
 */
export const detectMarketCrash = (price: CryptoPrice): Effect.Effect<CrashSignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];
    const volumes = price.volume24h ? [price.volume24h, price.volume24h] : [price.volume24h];

    // Calculate crash indicators
    const [rsi, atr, volumeROC, drawdown] = yield* Effect.all(
      [
        computeRSI(price),
        computeATR(highs, lows, closes),
        computeVolumeROC(volumes),
        computeMaximumDrawdown(closes),
      ],
      { concurrency: "unbounded" }
    );

    // Crash indicators
    const rapidDrop = price.change24h < -15; // >15% drop in 24h
    const volumeSpike = volumeROC.value > 100; // Volume doubled
    const oversoldExtreme = rsi.rsi < 20; // Extreme oversold
    const highVolatility = atr.normalizedATR > 10; // ATR > 10% of price

    // Count active indicators
    const activeIndicators = [rapidDrop, volumeSpike, oversoldExtreme, highVolatility].filter(
      Boolean
    ).length;

    // Determine crash status
    const isCrashing = activeIndicators >= 2;

    // Severity based on number of indicators
    const severity: CrashSignal["severity"] =
      activeIndicators === 4
        ? "EXTREME"
        : activeIndicators === 3
          ? "HIGH"
          : activeIndicators === 2
            ? "MEDIUM"
            : "LOW";

    // Confidence based on indicator strength
    const confidence = Math.round((activeIndicators / 4) * 100);

    // Generate recommendation
    const recommendation = generateCrashRecommendation(
      isCrashing,
      severity,
      price.change24h,
      rsi.rsi
    );

    return {
      isCrashing,
      severity,
      confidence,
      indicators: {
        rapidDrop,
        volumeSpike,
        oversoldExtreme,
        highVolatility,
      },
      recommendation,
    };
  });

/**
 * Pure function to generate crash recommendation
 */
const generateCrashRecommendation = (
  isCrashing: boolean,
  severity: CrashSignal["severity"],
  priceChange: number,
  rsi: number
): string => {
  if (!isCrashing) {
    return "No crash detected. Normal market conditions.";
  }

  switch (severity) {
    case "EXTREME":
      return `EXTREME CRASH: ${Math.abs(priceChange).toFixed(1)}% drop. AVOID buying. Wait for stabilization. Consider stop-losses.`;

    case "HIGH":
      return `HIGH SEVERITY CRASH: Significant selling pressure. Wait for RSI to recover above 30 before considering entry.`;

    case "MEDIUM":
      return `MEDIUM CRASH: Market stress detected. Only enter with tight stop-losses. Watch for reversal signals.`;

    case "LOW":
      return `LOW SEVERITY: Minor crash indicators. Monitor closely but not critical yet.`;
  }
};
