// ============================================================================
// BULL MARKET ENTRY USE CASE
// ============================================================================
// Detects when money is flowing into market - optimal entry conditions
// Identifies early bull market signals for maximum upside
// ============================================================================

import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { computeRSI } from "../../domain/formulas/momentum/rsi";
import { computeMACDFromPrice } from "../../domain/formulas/momentum/macd";
import { computeVolumeROC } from "../../domain/formulas/volume/volume-roc";
import { computeADX } from "../../domain/formulas/trend/adx";
import { detectDivergence } from "../../domain/formulas/momentum/rsi";

export interface BullEntrySignal {
  readonly isOptimalEntry: boolean;
  readonly strength: "WEAK" | "MODERATE" | "STRONG" | "VERY_STRONG";
  readonly confidence: number;
  readonly indicators: {
    readonly trendReversal: boolean;
    readonly volumeIncrease: boolean;
    readonly momentumBuilding: boolean;
    readonly bullishDivergence: boolean;
  };
  readonly entryPrice: number;
  readonly targetPrice: number;
  readonly stopLoss: number;
  readonly recommendation: string;
}

/**
 * Detect optimal bull market entry conditions
 * When to apply: Money flowing into market, early trend formation
 */
export const detectBullMarketEntry = (price: CryptoPrice): Effect.Effect<BullEntrySignal, never> =>
  Effect.gen(function* () {
    // Prepare price arrays for formulas
    const closes =
      price.high24h && price.low24h ? [price.low24h, price.price, price.high24h] : [price.price];
    const highs = price.high24h ? [price.high24h, price.high24h, price.high24h] : [price.price];
    const lows = price.low24h ? [price.low24h, price.low24h, price.low24h] : [price.price];
    const volumes = price.volume24h ? [price.volume24h, price.volume24h] : [price.volume24h];

    // Calculate bull entry indicators
    const [rsi, macd, volumeROC, adx, divergence] = yield* Effect.all(
      [
        computeRSI(price),
        computeMACDFromPrice(price),
        computeVolumeROC(volumes),
        computeADX(highs, lows, closes),
        detectDivergence(price),
      ],
      { concurrency: "unbounded" }
    );

    // Bull entry indicators
    const trendReversal = macd.trend === "BULLISH" && rsi.rsi > 40 && rsi.rsi < 70;
    const volumeIncrease = volumeROC.value > 20; // Volume up 20%+
    const momentumBuilding = adx.adx > 25 && price.change24h > 0;
    const bullishDivergence = divergence.hasDivergence && divergence.divergenceType === "BULLISH";

    // Count active indicators
    const activeIndicators = [
      trendReversal,
      volumeIncrease,
      momentumBuilding,
      bullishDivergence,
    ].filter(Boolean).length;

    // Determine entry status
    const isOptimalEntry = activeIndicators >= 2;

    // Strength based on number of indicators
    const strength: BullEntrySignal["strength"] =
      activeIndicators === 4
        ? "VERY_STRONG"
        : activeIndicators === 3
          ? "STRONG"
          : activeIndicators === 2
            ? "MODERATE"
            : "WEAK";

    // Confidence based on indicator strength and ADX
    const confidence = Math.round((activeIndicators / 4) * 70 + (adx.adx / 100) * 30);

    // Calculate entry levels
    const entryPrice = price.price;
    const targetPrice = calculateTarget(price, strength);
    const stopLoss = calculateStopLoss(price, strength);

    // Generate recommendation
    const recommendation = generateBullRecommendation(
      isOptimalEntry,
      strength,
      entryPrice,
      targetPrice,
      stopLoss
    );

    return {
      isOptimalEntry,
      strength,
      confidence,
      indicators: {
        trendReversal,
        volumeIncrease,
        momentumBuilding,
        bullishDivergence,
      },
      entryPrice,
      targetPrice,
      stopLoss,
      recommendation,
    };
  });

/**
 * Pure function to calculate target price
 */
const calculateTarget = (price: CryptoPrice, strength: BullEntrySignal["strength"]): number => {
  const multiplier =
    strength === "VERY_STRONG"
      ? 1.2
      : strength === "STRONG"
        ? 1.15
        : strength === "MODERATE"
          ? 1.1
          : 1.05;

  return price.price * multiplier;
};

/**
 * Pure function to calculate stop loss
 */
const calculateStopLoss = (price: CryptoPrice, strength: BullEntrySignal["strength"]): number => {
  // Tighter stop loss for stronger signals
  const stopPercent =
    strength === "VERY_STRONG"
      ? 0.05
      : strength === "STRONG"
        ? 0.07
        : strength === "MODERATE"
          ? 0.1
          : 0.12;

  return price.price * (1 - stopPercent);
};

/**
 * Pure function to generate bull entry recommendation
 */
const generateBullRecommendation = (
  isOptimalEntry: boolean,
  strength: BullEntrySignal["strength"],
  entry: number,
  target: number,
  stopLoss: number
): string => {
  if (!isOptimalEntry) {
    return "Not optimal entry. Wait for stronger bull signals.";
  }

  const riskReward = ((target - entry) / (entry - stopLoss)).toFixed(2);

  switch (strength) {
    case "VERY_STRONG":
      return `VERY STRONG BULL ENTRY: Multiple confirmations. Entry: $${entry.toFixed(2)}, Target: $${target.toFixed(2)}, Stop: $${stopLoss.toFixed(2)}. Risk/Reward: ${riskReward}:1. Consider larger position.`;

    case "STRONG":
      return `STRONG BULL ENTRY: Good setup with confirmation. Entry: $${entry.toFixed(2)}, Target: $${target.toFixed(2)}, Stop: $${stopLoss.toFixed(2)}. Risk/Reward: ${riskReward}:1.`;

    case "MODERATE":
      return `MODERATE BULL ENTRY: Decent setup but watch closely. Entry: $${entry.toFixed(2)}, Target: $${target.toFixed(2)}, Stop: $${stopLoss.toFixed(2)}. Risk/Reward: ${riskReward}:1. Use smaller position.`;

    case "WEAK":
      return `WEAK BULL SIGNAL: Entry possible but risky. Consider waiting for stronger confirmation.`;
  }
};
