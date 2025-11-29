/** Volatility Strategy - High volatility markets with extreme price swings */

import { Effect, Match, pipe } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import type { StrategySignal } from "./types";
import { computeATR } from "../formulas/volatility/atr";
import { computeHistoricalVolatility } from "../formulas/volatility/historical-volatility";
import { computeBollingerBands } from "../formulas/volatility/bollinger-bands";
import { computeRSI } from "../formulas/momentum/rsi";
import { computeADX } from "../formulas/trend/adx";

// Price array preparation
const preparePrices = (price: CryptoPrice) => ({
  closes:
    price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price],
  highs: price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price],
  lows: price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price],
});

// Bollinger Band extremes score
const bbExtremeScore = Match.type<number>().pipe(
  Match.when(
    (p) => p < 0.1,
    () => 40
  ),
  Match.when(
    (p) => p > 0.9,
    () => -40
  ),
  Match.orElse(() => 0)
);

// RSI confirmation score
const rsiConfirmationScore = (rsiSignal: string, percentB: number): number =>
  pipe(
    Match.value({ rsiSignal, percentB }),
    Match.when(
      ({ rsiSignal, percentB }) => rsiSignal === "OVERSOLD" && percentB < 0.2,
      () => 30
    ),
    Match.when(
      ({ rsiSignal, percentB }) => rsiSignal === "OVERBOUGHT" && percentB > 0.8,
      () => -30
    ),
    Match.orElse(() => 0)
  );

// Score to signal (higher thresholds for volatility)
const scoreToSignal = Match.type<number>().pipe(
  Match.when(
    (s) => s > 70,
    () => "STRONG_BUY" as const
  ),
  Match.when(
    (s) => s > 40,
    () => "BUY" as const
  ),
  Match.when(
    (s) => s < -70,
    () => "STRONG_SELL" as const
  ),
  Match.when(
    (s) => s < -40,
    () => "SELL" as const
  ),
  Match.orElse(() => "HOLD" as const)
);

// Position insight
const positionInsight = Match.type<number>().pipe(
  Match.when(
    (p) => p < 0.1,
    () => "price at extreme lower band"
  ),
  Match.when(
    (p) => p > 0.9,
    () => "price at extreme upper band"
  ),
  Match.orElse(() => "price not at extremes")
);

// RSI insight
const rsiInsight = Match.type<string>().pipe(
  Match.when("OVERSOLD", () => "RSI confirms oversold condition"),
  Match.when("OVERBOUGHT", () => "RSI confirms overbought condition"),
  Match.orElse(() => "RSI shows no clear signal")
);

// Build reasoning
const buildReasoning = (historicalVol: number, percentB: number, rsiSignal: string): string => {
  const parts = [
    `High volatility environment (${historicalVol.toFixed(1)}%)`,
    positionInsight(percentB),
    rsiInsight(rsiSignal),
    "exercise caution due to high volatility",
  ];
  return parts.join(", ");
};

// Focuses on risk management and avoiding false signals
export const volatilityStrategy = (price: CryptoPrice): Effect.Effect<StrategySignal, never> =>
  Effect.gen(function* () {
    const { closes, highs, lows } = preparePrices(price);

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

    // Calculate score using pattern matching
    const baseScore = bbExtremeScore(bb.percentB) + rsiConfirmationScore(rsi.signal, bb.percentB);

    // Apply volatility penalty
    const volPenalty = Math.min(historicalVol.value / 100, 0.3);
    const score = Math.max(-100, Math.min(100, baseScore * (1 - volPenalty)));

    // Confidence reduced in high volatility
    const baseConfidence = Math.abs(score);
    const volAdjustment = 1 - Math.min(historicalVol.value / 200, 0.4);
    const confidence = Math.min(100, Math.round(baseConfidence * volAdjustment));

    return {
      strategy: "VOLATILITY",
      signal: scoreToSignal(score),
      confidence,
      reasoning: buildReasoning(historicalVol.value, bb.percentB, rsi.signal),
      metrics: {
        atr: atr.value,
        normalizedATR: atr.normalizedATR,
        historicalVol: historicalVol.value,
        bbWidth: bb.bandwidth,
        rsi: rsi.rsi,
        adxValue: adx.adx,
      },
    };
  });
