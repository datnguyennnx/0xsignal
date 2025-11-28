// ============================================================================
// MEAN REVERSION STRATEGY
// ============================================================================
// Strategy for range-bound markets with price extremes
// Best for: MEAN_REVERSION, SIDEWAYS regimes
// Uses multiple indicators with proper weighting for balanced signals
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computePercentB } from "../formulas/mean-reversion/percent-b";
import { computeDistanceFromMA } from "../formulas/mean-reversion/distance-from-ma";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeStochastic } from "../formulas/momentum/stochastic";
import { computeADX } from "../formulas/trend/adx";
import { computeATR } from "../formulas/volatility/atr";
import { computeMACDFromPrice } from "../formulas/momentum/macd";
import {
  calculateIndicatorAgreement,
  calculateConfidence,
  calculateRiskScore,
} from "../analysis/scoring";

/**
 * Mean reversion strategy for range-bound markets
 * Uses multi-indicator consensus for balanced buy/sell signals
 */
export const meanReversionStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];

    // Calculate all indicators
    const [percentB, distanceFromMA, rsi, stochastic, adx, atr, macd] = yield* Effect.all(
      [
        computePercentB(price),
        computeDistanceFromMA(price),
        computeRSI(price),
        computeStochastic(closes, highs, lows),
        computeADX(highs, lows, closes),
        computeATR(highs, lows, closes),
        computeMACDFromPrice(price),
      ],
      { concurrency: "unbounded" }
    );

    // Collect indicator signals with weights
    const indicatorSignals: Array<{ signal: "BUY" | "SELL" | "NEUTRAL"; weight: number }> = [];

    // RSI signal (weight: 25) - primary oscillator
    // More sensitive thresholds for 24h data to generate balanced signals
    const rsiSignal = rsi.rsi < 45 ? "BUY" : rsi.rsi > 55 ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: rsiSignal, weight: 25 });

    // Stochastic signal (weight: 20)
    // With limited data, stochastic is unreliable - use RSI as proxy if stochastic is at extremes
    const effectiveStoch =
      stochastic.k === 100 || stochastic.k === 0
        ? rsi.rsi // Use RSI as proxy when stochastic is at data limits
        : stochastic.k;
    const stochSignal =
      effectiveStoch < 40 ? "BUY" : effectiveStoch > 60 ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: stochSignal, weight: 20 });

    // Percent B signal (weight: 20) - Bollinger position
    const percentBSignal =
      percentB.value < 0.4 ? "BUY" : percentB.value > 0.6 ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: percentBSignal, weight: 20 });

    // MACD signal (weight: 20) - momentum confirmation
    const macdSignal =
      macd.trend === "BULLISH" ? "BUY" : macd.trend === "BEARISH" ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: macdSignal, weight: 20 });

    // Distance from MA (weight: 10) - mean reversion core
    // Very sensitive for 24h data
    const distSignal =
      distanceFromMA.distance < -1
        ? "BUY"
        : distanceFromMA.distance > 1
          ? "SELL"
          : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: distSignal, weight: 10 });

    // 24h price momentum (weight: 15) - direct price action
    // Positive change = bullish momentum, negative = bearish
    const priceSignal =
      price.change24h > 1 ? "BUY" : price.change24h < -1 ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: priceSignal, weight: 15 });

    // Calculate indicator agreement
    const { agreement, direction } = calculateIndicatorAgreement(indicatorSignals);

    // Calculate score based on weighted signals
    let score = 0;
    for (const ind of indicatorSignals) {
      if (ind.signal === "BUY") score += ind.weight;
      else if (ind.signal === "SELL") score -= ind.weight;
    }

    // Normalize to -100 to 100
    score = Math.round((score / 100) * 100);

    const metrics: Record<string, number> = {
      percentB: Math.round(percentB.value * 100) / 100,
      distanceFromMA: Math.round(distanceFromMA.distance * 100) / 100,
      rsi: Math.round(rsi.rsi),
      stochastic: Math.round(stochastic.k),
      adxValue: Math.round(adx.adx),
      normalizedATR: Math.round(atr.normalizedATR * 100) / 100,
      macdTrend: macd.trend === "BULLISH" ? 1 : macd.trend === "BEARISH" ? -1 : 0,
      indicatorAgreement: Math.round(agreement * 100),
    };

    // Determine signal with adjusted thresholds for better balance
    const signal: StrategySignal["signal"] =
      score > 50
        ? "STRONG_BUY"
        : score > 15
          ? "BUY"
          : score < -50
            ? "STRONG_SELL"
            : score < -15
              ? "SELL"
              : "HOLD";

    // Calculate confidence using new formula
    const confidence = calculateConfidence(score, agreement, adx.adx, atr.normalizedATR);

    // Generate reasoning
    const reasoning = generateReasoning(
      indicatorSignals,
      direction,
      agreement,
      rsi,
      stochastic,
      percentB,
      macd
    );

    return {
      strategy: "MEAN_REVERSION",
      signal,
      confidence,
      reasoning,
      metrics,
    };
  });

/**
 * Pure function to generate human-readable reasoning
 */
const generateReasoning = (
  indicators: Array<{ signal: "BUY" | "SELL" | "NEUTRAL"; weight: number }>,
  direction: "BUY" | "SELL" | "NEUTRAL",
  agreement: number,
  rsi: Effect.Effect.Success<ReturnType<typeof computeRSI>>,
  stochastic: Effect.Effect.Success<ReturnType<typeof computeStochastic>>,
  percentB: Effect.Effect.Success<ReturnType<typeof computePercentB>>,
  macd: Effect.Effect.Success<ReturnType<typeof computeMACDFromPrice>>
): string => {
  const parts: string[] = [];

  // Agreement level
  const agreementPct = Math.round(agreement * 100);
  if (agreementPct >= 70) {
    parts.push(`strong indicator consensus (${agreementPct}%)`);
  } else if (agreementPct >= 50) {
    parts.push(`moderate indicator agreement (${agreementPct}%)`);
  } else {
    parts.push(`mixed signals (${agreementPct}% agreement)`);
  }

  // Key indicator insights
  if (rsi.rsi < 35) {
    parts.push(`RSI oversold (${Math.round(rsi.rsi)})`);
  } else if (rsi.rsi > 65) {
    parts.push(`RSI overbought (${Math.round(rsi.rsi)})`);
  }

  if (macd.trend !== "NEUTRAL") {
    parts.push(`MACD ${macd.trend.toLowerCase()}`);
  }

  if (percentB.value < 0.25) {
    parts.push("near lower BB");
  } else if (percentB.value > 0.75) {
    parts.push("near upper BB");
  }

  return parts.join(", ");
};
