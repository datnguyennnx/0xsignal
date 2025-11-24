import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "../types";
import { computeIndicators } from "../analysis/indicators";
import { scoreToSignal } from "../analysis/scoring";

export const executeMomentumStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    const indicators = yield* computeIndicators(price);

    let score = 0;
    const metrics: Record<string, number> = {
      rsi: indicators.rsi.rsi,
      macdTrend:
        indicators.macd.trend === "BULLISH" ? 1 : indicators.macd.trend === "BEARISH" ? -1 : 0,
      adxValue: indicators.adx.adx,
    };

    if (indicators.rsi.signal === "OVERSOLD") {
      score += 40;
    } else if (indicators.rsi.signal === "OVERBOUGHT") {
      score -= 40;
    } else {
      score += (indicators.rsi.rsi - 50) * 0.8;
    }

    if (indicators.macd.trend === "BULLISH") {
      score += 35;
    } else if (indicators.macd.trend === "BEARISH") {
      score -= 35;
    }

    const trendBonus = (indicators.adx.adx / 100) * 25;
    if (price.change24h > 0) {
      score += trendBonus;
    } else {
      score -= trendBonus;
    }

    score = Math.max(-100, Math.min(100, score));

    const signal = scoreToSignal(score);
    const confidence = Math.round(Math.abs(score) * 0.6 + indicators.adx.adx * 0.4);

    const reasoning = buildReasoning(
      indicators.rsi.signal,
      indicators.macd.trend,
      indicators.adx.adx
    );

    return {
      strategy: "MOMENTUM",
      signal,
      confidence: Math.min(100, confidence),
      reasoning,
      metrics,
    };
  });

const buildReasoning = (rsiSignal: string, macdTrend: string, adxValue: number): string => {
  const parts: string[] = [];

  if (rsiSignal === "OVERSOLD") {
    parts.push("RSI indicates oversold conditions");
  } else if (rsiSignal === "OVERBOUGHT") {
    parts.push("RSI indicates overbought conditions");
  } else {
    parts.push("RSI shows neutral momentum");
  }

  if (macdTrend === "BULLISH") {
    parts.push("MACD shows bullish trend");
  } else if (macdTrend === "BEARISH") {
    parts.push("MACD shows bearish trend");
  }

  if (adxValue > 50) {
    parts.push("very strong trend");
  } else if (adxValue > 25) {
    parts.push("strong trend");
  } else {
    parts.push("weak trend");
  }

  return parts.join(", ");
};
