// ============================================================================
// MEAN REVERSION STRATEGY
// ============================================================================
// Strategy for range-bound markets with price extremes
// Best for: MEAN_REVERSION, SIDEWAYS regimes
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computePercentB } from "../formulas/mean-reversion/percent-b";
import { computeDistanceFromMA } from "../formulas/mean-reversion/distance-from-ma";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeStochastic } from "../formulas/momentum/stochastic";

/**
 * Mean reversion strategy for range-bound markets
 * Identifies oversold/overbought conditions for reversal trades
 */
export const meanReversionStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];

    // Calculate mean reversion indicators
    const [percentB, distanceFromMA, rsi, stochastic] = yield* Effect.all(
      [
        computePercentB(price),
        computeDistanceFromMA(price),
        computeRSI(price),
        computeStochastic(closes, highs, lows),
      ],
      { concurrency: "unbounded" }
    );

    let score = 0;
    const metrics: Record<string, number> = {
      percentB: percentB.value,
      distanceFromMA: distanceFromMA.distance,
      rsi: rsi.rsi,
      stochastic: stochastic.k,
    };

    // Percent B contribution (35%)
    // < 0.2 = oversold (buy), > 0.8 = overbought (sell)
    if (percentB.value < 0.2) {
      score += 35 * (1 - percentB.value / 0.2); // 0 to 35
    } else if (percentB.value > 0.8) {
      score -= 35 * ((percentB.value - 0.8) / 0.2); // 0 to -35
    }

    // Distance from MA contribution (25%)
    // Negative = below MA (buy), Positive = above MA (sell)
    score -= distanceFromMA.distance * 2.5; // ±10% distance = ±25 points

    // RSI contribution (25%)
    if (rsi.signal === "OVERSOLD") {
      score += 25;
    } else if (rsi.signal === "OVERBOUGHT") {
      score -= 25;
    }

    // Stochastic contribution (15%)
    if (stochastic.signal === "OVERSOLD") {
      score += 15;
    } else if (stochastic.signal === "OVERBOUGHT") {
      score -= 15;
    }

    // Normalize score to -100 to +100
    score = Math.max(-100, Math.min(100, score));

    // Determine signal (inverted for mean reversion)
    // Oversold = BUY, Overbought = SELL
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

    // Confidence based on multiple indicators agreeing
    const indicatorsAgreeing = [
      percentB.value < 0.2 || percentB.value > 0.8,
      Math.abs(distanceFromMA.distance) > 5,
      rsi.signal !== "NEUTRAL",
      stochastic.signal !== "NEUTRAL",
    ].filter(Boolean).length;

    const confidence = Math.round(Math.abs(score) * 0.6 + (indicatorsAgreeing / 4) * 100 * 0.4);

    // Generate reasoning
    const reasoning = generateReasoning(signal, percentB, distanceFromMA, rsi, stochastic);

    return {
      strategy: "MEAN_REVERSION",
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
  percentB: Effect.Effect.Success<ReturnType<typeof computePercentB>>,
  distanceFromMA: Effect.Effect.Success<ReturnType<typeof computeDistanceFromMA>>,
  rsi: Effect.Effect.Success<ReturnType<typeof computeRSI>>,
  stochastic: Effect.Effect.Success<ReturnType<typeof computeStochastic>>
): string => {
  const parts: string[] = [];

  // Percent B insight
  if (percentB.value < 0.2) {
    parts.push("price near lower Bollinger Band (oversold)");
  } else if (percentB.value > 0.8) {
    parts.push("price near upper Bollinger Band (overbought)");
  } else {
    parts.push("price in middle of Bollinger Bands");
  }

  // Distance from MA insight
  if (distanceFromMA.distance < -5) {
    parts.push(`${Math.abs(distanceFromMA.distance).toFixed(1)}% below moving average`);
  } else if (distanceFromMA.distance > 5) {
    parts.push(`${distanceFromMA.distance.toFixed(1)}% above moving average`);
  }

  // RSI/Stochastic confirmation
  if (rsi.signal === stochastic.signal && rsi.signal !== "NEUTRAL") {
    parts.push(`confirmed by ${rsi.signal.toLowerCase()} RSI and Stochastic`);
  }

  return parts.join(", ");
};
