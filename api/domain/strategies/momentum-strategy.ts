// ============================================================================
// MOMENTUM STRATEGY
// ============================================================================
// Strategy for trending markets with strong directional movement
// Best for: BULL_MARKET, BEAR_MARKET, TRENDING regimes
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeMACDFromPrice } from "../formulas/momentum/macd";
import { computeADX } from "../formulas/trend/adx";

/**
 * Momentum strategy for trending markets
 * Combines RSI, MACD, and ADX to identify strong trends
 */
export const momentumStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];

    // Calculate momentum indicators
    const [rsi, macd, adx] = yield* Effect.all(
      [computeRSI(price), computeMACDFromPrice(price), computeADX(highs, lows, closes)],
      { concurrency: "unbounded" }
    );

    // Score calculation (0-100)
    let score = 0;
    const metrics: Record<string, number> = {
      rsi: rsi.rsi,
      macdTrend: macd.trend === "BULLISH" ? 1 : macd.trend === "BEARISH" ? -1 : 0,
      adxValue: adx.adx,
    };

    // RSI contribution (40%)
    if (rsi.signal === "OVERSOLD") {
      score += 40; // Bullish
    } else if (rsi.signal === "OVERBOUGHT") {
      score -= 40; // Bearish
    } else {
      score += (rsi.rsi - 50) * 0.8; // Neutral: -20 to +20
    }

    // MACD contribution (35%)
    if (macd.trend === "BULLISH") {
      score += 35;
    } else if (macd.trend === "BEARISH") {
      score -= 35;
    }

    // ADX trend strength contribution (25%)
    // Strong trend increases confidence in direction
    const trendBonus = (adx.adx / 100) * 25;
    if (price.change24h > 0) {
      score += trendBonus;
    } else {
      score -= trendBonus;
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

    // Confidence based on trend strength and score magnitude
    const confidence = Math.round(Math.abs(score) * 0.6 + adx.adx * 0.4);

    // Generate reasoning
    const reasoning = generateReasoning(signal, rsi, macd, adx);

    return {
      strategy: "MOMENTUM",
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
  rsi: Effect.Effect.Success<ReturnType<typeof computeRSI>>,
  macd: Effect.Effect.Success<ReturnType<typeof computeMACDFromPrice>>,
  adx: Effect.Effect.Success<ReturnType<typeof computeADX>>
): string => {
  const parts: string[] = [];

  // RSI insight
  if (rsi.signal === "OVERSOLD") {
    parts.push("RSI indicates oversold conditions");
  } else if (rsi.signal === "OVERBOUGHT") {
    parts.push("RSI indicates overbought conditions");
  } else {
    parts.push(`RSI at ${rsi.rsi.toFixed(1)} shows neutral momentum`);
  }

  // MACD insight
  if (macd.trend === "BULLISH") {
    parts.push("MACD shows bullish trend");
  } else if (macd.trend === "BEARISH") {
    parts.push("MACD shows bearish trend");
  }

  // ADX insight
  if (adx.adx > 50) {
    parts.push("very strong trend");
  } else if (adx.adx > 25) {
    parts.push("strong trend");
  } else {
    parts.push("weak trend");
  }

  return parts.join(", ");
};
