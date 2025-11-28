// ============================================================================
// BREAKOUT STRATEGY
// ============================================================================
// Strategy for low volatility periods preceding large moves
// Best for: LOW_VOLATILITY regime (Bollinger Squeeze)
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { detectSqueeze } from "../formulas/volatility/bollinger-bands";
import { computeATR } from "../formulas/volatility/atr";
import { computeVolumeROC } from "../formulas/volume/volume-roc";
import { computeDonchianChannels } from "../formulas/volatility/donchian-channels";
import { computeADX } from "../formulas/trend/adx";

/**
 * Breakout strategy for low volatility compression
 * Identifies potential breakouts from consolidation patterns
 */
export const breakoutStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];
    const volumes = price.volume24h ? [price.volume24h, price.volume24h] : [price.volume24h];

    // Calculate breakout indicators
    const [squeeze, atr, volumeROC, donchian, adx] = yield* Effect.all(
      [
        detectSqueeze(price),
        computeATR(highs, lows, closes),
        computeVolumeROC(volumes),
        computeDonchianChannels(highs, lows, closes),
        computeADX(highs, lows, closes),
      ],
      { concurrency: "unbounded" }
    );

    let score = 0;
    const metrics: Record<string, number> = {
      squeezeIntensity: squeeze.squeezeIntensity,
      atr: atr.value,
      normalizedATR: atr.normalizedATR,
      volumeROC: volumeROC.value,
      donchianPosition: donchian.position,
      adxValue: adx.adx,
    };

    // Squeeze intensity contribution (40%)
    // Higher squeeze = higher potential breakout
    if (squeeze.isSqueezing) {
      const squeezeScore = (squeeze.squeezeIntensity / 100) * 40;

      if (squeeze.breakoutDirection === "BULLISH") {
        score += squeezeScore;
      } else if (squeeze.breakoutDirection === "BEARISH") {
        score -= squeezeScore;
      }
    }

    // Donchian Channel position (30%)
    // Near upper channel = bullish, near lower = bearish
    if (donchian.position > 0.8) {
      score += 30;
    } else if (donchian.position < 0.2) {
      score -= 30;
    }

    // Volume confirmation (20%)
    // Increasing volume confirms breakout
    if (volumeROC.value > 20) {
      score += 20 * (price.change24h > 0 ? 1 : -1);
    }

    // ATR volatility expansion (10%)
    // Rising volatility confirms breakout
    if (atr.volatilityLevel === "HIGH" || atr.volatilityLevel === "VERY_HIGH") {
      score += 10 * (price.change24h > 0 ? 1 : -1);
    }

    // Normalize score to -100 to +100
    score = Math.max(-100, Math.min(100, score));

    // Determine signal
    const signal: StrategySignal["signal"] =
      score > 60
        ? "STRONG_BUY"
        : score > 20
          ? "BUY"
          : score < -60
            ? "STRONG_SELL"
            : score < -20
              ? "SELL"
              : "HOLD";

    // Confidence based on squeeze intensity and volume
    const confidence = Math.round(
      squeeze.squeezeIntensity * 0.5 + Math.min(volumeROC.value, 100) * 0.3 + Math.abs(score) * 0.2
    );

    // Generate reasoning
    const reasoning = generateReasoning(signal, squeeze, atr, volumeROC, donchian);

    return {
      strategy: "BREAKOUT",
      signal,
      confidence: Math.min(100, confidence),
      reasoning,
      metrics,
    };
  });

/**
 * Pure function to generate human-readable reasoning
 */
const generateReasoning = (
  signal: StrategySignal["signal"],
  squeeze: Effect.Effect.Success<ReturnType<typeof detectSqueeze>>,
  atr: Effect.Effect.Success<ReturnType<typeof computeATR>>,
  volumeROC: Effect.Effect.Success<ReturnType<typeof computeVolumeROC>>,
  donchian: Effect.Effect.Success<ReturnType<typeof computeDonchianChannels>>
): string => {
  const parts: string[] = [];

  // Squeeze insight
  if (squeeze.isSqueezing) {
    parts.push(`Bollinger Squeeze detected (${squeeze.squeezeIntensity}% intensity)`);
    if (squeeze.breakoutDirection !== "NEUTRAL") {
      parts.push(`potential ${squeeze.breakoutDirection.toLowerCase()} breakout`);
    }
  } else {
    parts.push("no squeeze pattern detected");
  }

  // Volume insight
  if (volumeROC.signal === "SURGE") {
    parts.push("strong volume surge");
  } else if (volumeROC.signal === "HIGH") {
    parts.push("increasing volume");
  }

  // ATR insight
  if (atr.volatilityLevel === "HIGH" || atr.volatilityLevel === "VERY_HIGH") {
    parts.push("volatility expanding");
  } else if (atr.volatilityLevel === "LOW" || atr.volatilityLevel === "VERY_LOW") {
    parts.push("volatility contracting");
  }

  // Donchian position
  if (donchian.position > 0.8) {
    parts.push("price near upper channel");
  } else if (donchian.position < 0.2) {
    parts.push("price near lower channel");
  }

  return parts.join(", ");
};
