import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { detectSqueeze, type BollingerSqueezeSignal } from "./volatility";
import { detectDivergence, type RSIDivergenceSignal } from "./momentum";
import { computePercentB } from "./mean-reversion/percent-b";
import { computeBBWidth } from "./mean-reversion/bollinger-width";
import { computeDistanceFromMA } from "./mean-reversion/distance-from-ma";
import { calculateEnhancedMetrics } from "./metrics";
import { computeCompositeScores, type CompositeScores } from "./composite-scores";

// ============================================================================
// MULTI-INDICATOR ANALYZER
// ============================================================================
// Combines multiple quantitative formulas for comprehensive market analysis
// Uses functional composition with Effect-TS
// ============================================================================

export interface QuantitativeAnalysis {
  readonly symbol: string;
  readonly timestamp: Date;

  // Core indicators
  readonly bollingerSqueeze: BollingerSqueezeSignal;
  readonly rsiDivergence: RSIDivergenceSignal;

  // Mean reversion indicators
  readonly percentB: number; // 0-1 (position in Bollinger Bands)
  readonly bollingerWidth: number; // % (band width)
  readonly distanceFromMA: number; // % (distance from moving average)

  // Volume indicators
  readonly volumeROC: number; // % (volume rate of change)
  readonly volumeToMarketCapRatio: number; // ratio (liquidity measure)

  // Volatility indicators
  readonly dailyRange: number; // % (24h high-low range)
  readonly athDistance: number; // % (distance from all-time high)

  // Composite scores
  readonly compositeScores: CompositeScores;

  // Overall assessment
  readonly overallSignal: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  readonly confidence: number;
  readonly riskScore: number;
}

/**
 * Effect-based comprehensive quantitative analysis
 * Runs all formulas in parallel for efficiency
 */
export const analyzeWithFormulas = (price: CryptoPrice): Effect.Effect<QuantitativeAnalysis> =>
  Effect.gen(function* () {
    // Run all formulas in parallel
    const [squeeze, divergence, percentBResult, bollingerWidthResult, distanceFromMAResult] =
      yield* Effect.all(
        [
          detectSqueeze(price),
          detectDivergence(price),
          computePercentB(price),
          computeBBWidth(price),
          computeDistanceFromMA(price),
        ],
        { concurrency: "unbounded" }
      );

    // Extract values from results
    const percentB = percentBResult.value;
    const bollingerWidth = bollingerWidthResult.widthPercent;
    const distanceFromMA = distanceFromMAResult.distance;

    // Calculate enhanced metrics
    const enhanced = yield* Effect.sync(() => calculateEnhancedMetrics(price));

    // Calculate derived metrics
    const volumeToMarketCapRatio = price.volume24h / price.marketCap;
    const dailyRange =
      price.high24h && price.low24h ? ((price.high24h - price.low24h) / price.price) * 100 : 0;
    const athDistance = price.ath ? ((price.ath - price.price) / price.ath) * 100 : 0;

    // Calculate volume ROC (simplified - using 24h change as proxy)
    const volumeROC = price.change24h; // Simplified for single price point

    // Compute composite scores
    const compositeScores = yield* computeCompositeScores(
      divergence.rsi,
      volumeROC,
      price.change24h,
      bollingerWidth,
      dailyRange,
      athDistance,
      percentB,
      distanceFromMA
    );

    // Determine overall signal from composite scores
    const { overallSignal, confidence } = yield* Effect.sync(() =>
      calculateOverallSignal(compositeScores, squeeze, divergence)
    );

    return {
      symbol: price.symbol,
      timestamp: new Date(),
      bollingerSqueeze: squeeze,
      rsiDivergence: divergence,
      percentB,
      bollingerWidth,
      distanceFromMA,
      volumeROC,
      volumeToMarketCapRatio,
      dailyRange,
      athDistance,
      compositeScores,
      overallSignal,
      confidence,
      riskScore: enhanced.quantRiskScore,
    };
  });

/**
 * Pure function to calculate overall trading signal
 * Combines composite scores with specific indicators
 */
const calculateOverallSignal = (
  compositeScores: CompositeScores,
  squeeze: BollingerSqueezeSignal,
  divergence: RSIDivergenceSignal
): { overallSignal: QuantitativeAnalysis["overallSignal"]; confidence: number } => {
  // Primary signal from momentum score
  const momentumScore = compositeScores.momentum.score; // -100 to +100

  // Mean reversion adjustment
  const mrScore = compositeScores.meanReversion.score; // -100 to +100

  // Combine: Momentum 70%, Mean Reversion 30%
  let combinedScore = momentumScore * 0.7 + mrScore * 0.3;

  // Boost signal if Bollinger Squeeze confirms
  if (squeeze.isSqueezing) {
    const squeezeBoost =
      squeeze.breakoutDirection === "BULLISH"
        ? 20
        : squeeze.breakoutDirection === "BEARISH"
          ? -20
          : 0;
    combinedScore += squeezeBoost * (squeeze.confidence / 100);
  }

  // Boost signal if RSI Divergence confirms
  if (divergence.hasDivergence) {
    const divergenceBoost =
      divergence.divergenceType === "BULLISH"
        ? 15
        : divergence.divergenceType === "BEARISH"
          ? -15
          : 0;
    combinedScore += divergenceBoost * (divergence.strength / 100);
  }

  // Cap at -100 to +100
  combinedScore = Math.max(-100, Math.min(100, combinedScore));

  // Determine signal
  const overallSignal: QuantitativeAnalysis["overallSignal"] =
    combinedScore > 60
      ? "STRONG_BUY"
      : combinedScore > 20
        ? "BUY"
        : combinedScore < -60
          ? "STRONG_SELL"
          : combinedScore < -20
            ? "SELL"
            : "HOLD";

  // Confidence based on quality score and signal strength
  const signalStrength = Math.abs(combinedScore);
  const confidence = Math.round(signalStrength * 0.6 + compositeScores.overallQuality * 0.4);

  return { overallSignal, confidence: Math.min(100, confidence) };
};

/**
 * Effect-based batch analysis for multiple cryptocurrencies
 */
export const analyzeBatch = (
  prices: ReadonlyArray<CryptoPrice>
): Effect.Effect<ReadonlyArray<QuantitativeAnalysis>> =>
  Effect.forEach(prices, (price) => analyzeWithFormulas(price), { concurrency: "unbounded" });

/**
 * Effect-based filter for high-confidence signals
 */
export const filterHighConfidence = (
  analyses: ReadonlyArray<QuantitativeAnalysis>,
  minConfidence: number = 70
): Effect.Effect<ReadonlyArray<QuantitativeAnalysis>> =>
  Effect.sync(() => analyses.filter((analysis) => analysis.confidence >= minConfidence));

/**
 * Effect-based ranking by quality score
 * Quality = confidence - (riskScore / 2)
 */
export const rankByQuality = (
  analyses: ReadonlyArray<QuantitativeAnalysis>
): Effect.Effect<ReadonlyArray<QuantitativeAnalysis>> =>
  Effect.sync(() =>
    [...analyses].sort((a, b) => {
      const qualityA = a.confidence - a.riskScore / 2;
      const qualityB = b.confidence - b.riskScore / 2;
      return qualityB - qualityA;
    })
  );
