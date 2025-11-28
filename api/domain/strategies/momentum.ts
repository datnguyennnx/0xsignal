import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computeIndicators } from "../analysis/indicators";
import {
  scoreToSignal,
  calculateIndicatorAgreement,
  calculateConfidence,
} from "../analysis/scoring";

export const executeMomentumStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);

    // Collect indicator signals with weights for consensus
    const indicatorSignals: Array<{ signal: "BUY" | "SELL" | "NEUTRAL"; weight: number }> = [];

    // RSI signal (weight: 30) - more sensitive for 24h data
    const rsiSignal =
      indicators.rsi.rsi < 48 ? "BUY" : indicators.rsi.rsi > 52 ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: rsiSignal, weight: 30 });

    // MACD signal (weight: 30)
    const macdSignal =
      indicators.macd.trend === "BULLISH"
        ? "BUY"
        : indicators.macd.trend === "BEARISH"
          ? "SELL"
          : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: macdSignal, weight: 30 });

    // Price momentum (weight: 25) - 24h change, more sensitive
    const priceSignal =
      price.change24h > 0.5 ? "BUY" : price.change24h < -0.5 ? "SELL" : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: priceSignal, weight: 25 });

    // Divergence signal (weight: 15)
    const divSignal = indicators.divergence.hasDivergence
      ? indicators.divergence.divergenceType === "BULLISH"
        ? "BUY"
        : indicators.divergence.divergenceType === "BEARISH"
          ? "SELL"
          : ("NEUTRAL" as const)
      : ("NEUTRAL" as const);
    indicatorSignals.push({ signal: divSignal, weight: 15 });

    // Calculate indicator agreement
    const { agreement, direction } = calculateIndicatorAgreement(indicatorSignals);

    // Calculate score based on weighted signals
    let score = 0;
    for (const ind of indicatorSignals) {
      if (ind.signal === "BUY") score += ind.weight;
      else if (ind.signal === "SELL") score -= ind.weight;
    }

    const metrics: Record<string, number> = {
      rsi: Math.round(indicators.rsi.rsi),
      macdTrend:
        indicators.macd.trend === "BULLISH" ? 1 : indicators.macd.trend === "BEARISH" ? -1 : 0,
      adxValue: Math.round(indicators.adx.adx),
      normalizedATR: Math.round(indicators.atr.normalizedATR * 100) / 100,
      indicatorAgreement: Math.round(agreement * 100),
      priceChange24h: Math.round(price.change24h * 100) / 100,
    };

    const signal = scoreToSignal(score);
    const confidence = calculateConfidence(
      score,
      agreement,
      indicators.adx.adx,
      indicators.atr.normalizedATR
    );

    const reasoning = buildReasoning(
      indicators.rsi,
      indicators.macd.trend,
      indicators.adx.adx,
      agreement,
      price.change24h
    );

    return {
      strategy: "MOMENTUM",
      signal,
      confidence,
      reasoning,
      metrics,
    };
  });

const buildReasoning = (
  rsi: { rsi: number; signal: string },
  macdTrend: string,
  adxValue: number,
  agreement: number,
  priceChange: number
): string => {
  const parts: string[] = [];

  // Agreement level
  const agreementPct = Math.round(agreement * 100);
  if (agreementPct >= 70) {
    parts.push(`strong consensus (${agreementPct}%)`);
  } else if (agreementPct >= 50) {
    parts.push(`moderate agreement (${agreementPct}%)`);
  } else {
    parts.push(`mixed signals (${agreementPct}%)`);
  }

  // RSI insight
  if (rsi.rsi < 40) {
    parts.push(`RSI bullish (${Math.round(rsi.rsi)})`);
  } else if (rsi.rsi > 60) {
    parts.push(`RSI bearish (${Math.round(rsi.rsi)})`);
  }

  // MACD
  if (macdTrend !== "NEUTRAL") {
    parts.push(`MACD ${macdTrend.toLowerCase()}`);
  }

  // Trend strength
  if (adxValue > 40) {
    parts.push("strong trend");
  } else if (adxValue < 20) {
    parts.push("weak trend");
  }

  return parts.join(", ");
};
