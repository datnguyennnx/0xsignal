import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";

// ============================================================================
// COMPOSITE SCORING SYSTEM
// ============================================================================
// Combines multiple indicators into actionable trading scores
// Pure functional approach with Effect-TS
// ============================================================================

export interface MomentumScore {
  readonly rsi: number; // 0-100
  readonly volumeROC: number; // % change
  readonly priceChange24h: number; // % change
  readonly score: number; // -100 to +100
  readonly signal: "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH";
  readonly insight: string;
}

export interface VolatilityScore {
  readonly bollingerWidth: number; // %
  readonly dailyRange: number; // %
  readonly athDistance: number; // %
  readonly score: number; // 0-100
  readonly regime: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  readonly insight: string;
}

export interface MeanReversionScore {
  readonly percentB: number; // 0-1
  readonly distanceFromMA: number; // %
  readonly score: number; // -100 to +100
  readonly signal: "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT";
  readonly insight: string;
}

export interface CompositeScores {
  readonly momentum: MomentumScore;
  readonly volatility: VolatilityScore;
  readonly meanReversion: MeanReversionScore;
  readonly overallQuality: number; // 0-100
}

/**
 * Calculate momentum score from RSI, volume, and price action
 */
export const computeMomentumScore = (
  rsi: number,
  volumeROC: number,
  priceChange24h: number
): Effect.Effect<MomentumScore> =>
  Effect.sync(() => {
    // Normalize RSI to -100 to +100 scale (50 = neutral)
    const rsiScore = (rsi - 50) * 2;

    // Volume ROC contribution (capped at ±50)
    const volumeScore = Math.max(-50, Math.min(50, volumeROC));

    // Price change contribution (capped at ±50)
    const priceScore = Math.max(-50, Math.min(50, priceChange24h * 2));

    // Weighted average: RSI 50%, Volume 25%, Price 25%
    const score = Math.round(rsiScore * 0.5 + volumeScore * 0.25 + priceScore * 0.25);

    // Determine signal
    const signal: MomentumScore["signal"] =
      score > 60
        ? "STRONG_BULLISH"
        : score > 20
          ? "BULLISH"
          : score < -60
            ? "STRONG_BEARISH"
            : score < -20
              ? "BEARISH"
              : "NEUTRAL";

    // Generate insight
    const insight =
      signal === "STRONG_BULLISH"
        ? "Strong buying pressure with high volume"
        : signal === "BULLISH"
          ? "Positive momentum building"
          : signal === "STRONG_BEARISH"
            ? "Strong selling pressure with high volume"
            : signal === "BEARISH"
              ? "Negative momentum building"
              : "Sideways movement, wait for clear direction";

    return {
      rsi,
      volumeROC,
      priceChange24h,
      score,
      signal,
      insight,
    };
  });

/**
 * Calculate volatility score from multiple volatility indicators
 */
export const computeVolatilityScore = (
  bollingerWidth: number,
  dailyRange: number,
  athDistance: number
): Effect.Effect<VolatilityScore> =>
  Effect.sync(() => {
    // Normalize each component to 0-100
    const bbScore = Math.min(100, bollingerWidth * 10);
    const rangeScore = Math.min(100, dailyRange * 10);
    const athScore = Math.min(100, 100 - athDistance);

    // Weighted average: BB 40%, Range 40%, ATH 20%
    const score = Math.round(bbScore * 0.4 + rangeScore * 0.4 + athScore * 0.2);

    // Determine regime
    const regime: VolatilityScore["regime"] =
      score > 75 ? "EXTREME" : score > 50 ? "HIGH" : score > 25 ? "NORMAL" : "LOW";

    // Generate insight
    const insight =
      regime === "EXTREME"
        ? "Extreme volatility - high risk, high reward"
        : regime === "HIGH"
          ? "High volatility - expect large price swings"
          : regime === "NORMAL"
            ? "Normal volatility - typical market conditions"
            : "Low volatility - potential breakout coming";

    return {
      bollingerWidth,
      dailyRange,
      athDistance,
      score,
      regime,
      insight,
    };
  });

/**
 * Calculate mean reversion score
 */
export const computeMeanReversionScore = (
  percentB: number,
  distanceFromMA: number
): Effect.Effect<MeanReversionScore> =>
  Effect.sync(() => {
    // Percent B: 0 = oversold, 1 = overbought, 0.5 = neutral
    const pbScore = (percentB - 0.5) * 200; // -100 to +100

    // Distance from MA: negative = below, positive = above
    const maScore = Math.max(-100, Math.min(100, distanceFromMA * 10));

    // Weighted average: Percent B 60%, MA Distance 40%
    const score = Math.round(pbScore * 0.6 + maScore * 0.4);

    // Determine signal
    const signal: MeanReversionScore["signal"] =
      score < -40 ? "OVERSOLD" : score > 40 ? "OVERBOUGHT" : "NEUTRAL";

    // Generate insight
    const insight =
      signal === "OVERSOLD"
        ? "Price below average - potential bounce"
        : signal === "OVERBOUGHT"
          ? "Price above average - potential pullback"
          : "Price near average - no clear mean reversion signal";

    return {
      percentB,
      distanceFromMA,
      score,
      signal,
      insight,
    };
  });

/**
 * Calculate overall quality score
 * Combines momentum confidence, volatility regime, and mean reversion clarity
 */
export const computeOverallQuality = (
  momentum: MomentumScore,
  volatility: VolatilityScore,
  meanReversion: MeanReversionScore
): number => {
  // Momentum quality: stronger signals = higher quality
  const momentumQuality = Math.abs(momentum.score);

  // Volatility quality: normal/high is good, extreme/low is risky
  const volatilityQuality =
    volatility.regime === "NORMAL"
      ? 80
      : volatility.regime === "HIGH"
        ? 60
        : volatility.regime === "LOW"
          ? 40
          : 20; // EXTREME

  // Mean reversion quality: clear signals = higher quality
  const mrQuality = Math.abs(meanReversion.score);

  // Weighted average: Momentum 40%, Volatility 30%, MR 30%
  return Math.round(momentumQuality * 0.4 + volatilityQuality * 0.3 + mrQuality * 0.3);
};

/**
 * Compute all composite scores at once
 */
export const computeCompositeScores = (
  rsi: number,
  volumeROC: number,
  priceChange24h: number,
  bollingerWidth: number,
  dailyRange: number,
  athDistance: number,
  percentB: number,
  distanceFromMA: number
): Effect.Effect<CompositeScores> =>
  Effect.gen(function* () {
    const [momentum, volatility, meanReversion] = yield* Effect.all(
      [
        computeMomentumScore(rsi, volumeROC, priceChange24h),
        computeVolatilityScore(bollingerWidth, dailyRange, athDistance),
        computeMeanReversionScore(percentB, distanceFromMA),
      ],
      { concurrency: "unbounded" }
    );

    const overallQuality = computeOverallQuality(momentum, volatility, meanReversion);

    return {
      momentum,
      volatility,
      meanReversion,
      overallQuality,
    };
  });
