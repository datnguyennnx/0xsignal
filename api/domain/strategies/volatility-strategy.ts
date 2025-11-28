// ============================================================================
// VOLATILITY STRATEGY
// ============================================================================
// Strategy for high volatility markets with extreme price swings
// Best for: HIGH_VOLATILITY regime
// Focus: Risk management and short-term opportunities
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computeATR } from "../formulas/volatility/atr";
import { computeHistoricalVolatility } from "../formulas/volatility/historical-volatility";
import { computeBollingerBands } from "../formulas/volatility/bollinger-bands";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeADX } from "../formulas/trend/adx";

/**
 * Volatility strategy for extreme market conditions
 * Focuses on risk management and avoiding false signals
 */
export const volatilityStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];

    // Calculate volatility indicators
    const [atr, historicalVol, bb, rsi, adx] = yield* Effect.all(
      [
        computeATR(highs, lows, closes),
        computeHistoricalVolatility(closes),
        computeBollingerBands(price),
        computeRSI(price),
        computeADX(highs, lows, closes),
      ],
      { concurrency: "unbounded" }
    );

    let score = 0;
    const metrics: Record<string, number> = {
      atr: atr.value,
      normalizedATR: atr.normalizedATR,
      historicalVol: historicalVol.value,
      bbWidth: bb.bandwidth,
      rsi: rsi.rsi,
      adxValue: adx.adx,
    };

    // In high volatility, we're more conservative
    // Only trade at extremes with confirmation

    // Bollinger Band extremes (40%)
    if (bb.percentB < 0.1) {
      // Extreme oversold
      score += 40;
    } else if (bb.percentB > 0.9) {
      // Extreme overbought
      score -= 40;
    }

    // RSI confirmation (30%)
    // Only trade if RSI confirms the extreme
    if (rsi.signal === "OVERSOLD" && bb.percentB < 0.2) {
      score += 30;
    } else if (rsi.signal === "OVERBOUGHT" && bb.percentB > 0.8) {
      score -= 30;
    }

    // Volatility level adjustment (30%)
    // Higher volatility = lower confidence, require stronger signals
    const volPenalty = Math.min(historicalVol.value / 100, 0.3);
    score *= 1 - volPenalty;

    // Normalize score to -100 to +100
    score = Math.max(-100, Math.min(100, score));

    // In high volatility, we're more conservative with signals
    // Require higher thresholds
    const signal: StrategySignal["signal"] =
      score > 70
        ? "STRONG_BUY"
        : score > 40
          ? "BUY"
          : score < -70
            ? "STRONG_SELL"
            : score < -40
              ? "SELL"
              : "HOLD";

    // Confidence is reduced in high volatility
    const baseConfidence = Math.abs(score);
    const volAdjustment = 1 - Math.min(historicalVol.value / 200, 0.4);
    const confidence = Math.round(baseConfidence * volAdjustment);

    // Generate reasoning
    const reasoning = generateReasoning(signal, atr, historicalVol, bb, rsi);

    return {
      strategy: "VOLATILITY",
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
  atr: Effect.Effect.Success<ReturnType<typeof computeATR>>,
  historicalVol: Effect.Effect.Success<ReturnType<typeof computeHistoricalVolatility>>,
  bb: Effect.Effect.Success<ReturnType<typeof computeBollingerBands>>,
  rsi: Effect.Effect.Success<ReturnType<typeof computeRSI>>
): string => {
  const parts: string[] = [];

  // Volatility warning
  parts.push(`High volatility environment (${historicalVol.value.toFixed(1)}%)`);

  // Position insight
  if (bb.percentB < 0.1) {
    parts.push("price at extreme lower band");
  } else if (bb.percentB > 0.9) {
    parts.push("price at extreme upper band");
  } else {
    parts.push("price not at extremes");
  }

  // RSI confirmation
  if (rsi.signal !== "NEUTRAL") {
    parts.push(`RSI confirms ${rsi.signal.toLowerCase()} condition`);
  } else {
    parts.push("RSI shows no clear signal");
  }

  // Risk warning
  parts.push("exercise caution due to high volatility");

  return parts.join(", ");
};
