import { Effect } from "effect";
import type { CryptoPrice } from "@0xsignal/shared";
import { computeBollingerBands, detectSqueeze, type BollingerSqueezeSignal } from "./volatility";
import { computeRSI, detectDivergence, type RSIDivergenceSignal, type RSIResult } from "./momentum";
import { calculateEnhancedMetrics } from "./metrics";

// ============================================================================
// MULTI-INDICATOR ANALYZER
// ============================================================================
// Combines multiple quantitative formulas for comprehensive market analysis
// Uses functional composition with Effect-TS
// ============================================================================

export interface QuantitativeAnalysis {
  readonly symbol: string;
  readonly timestamp: Date;
  readonly bollingerSqueeze: BollingerSqueezeSignal;
  readonly rsiDivergence: RSIDivergenceSignal;
  readonly overallSignal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  readonly confidence: number;
  readonly riskScore: number;
}

/**
 * Effect-based comprehensive quantitative analysis
 * Runs all formulas in parallel for efficiency
 */
export const analyzeWithFormulas = (
  price: CryptoPrice
): Effect.Effect<QuantitativeAnalysis> =>
  Effect.gen(function* () {
    // Run all formulas in parallel
    const [squeeze, divergence] = yield* Effect.all([
      detectSqueeze(price),
      detectDivergence(price),
    ], { concurrency: "unbounded" });
    
    // Calculate enhanced metrics for risk score
    const enhanced = yield* Effect.sync(() => calculateEnhancedMetrics(price));
    
    // Determine overall signal
    const { overallSignal, confidence } = yield* Effect.sync(() => 
      calculateOverallSignal(squeeze, divergence)
    );
    
    return {
      symbol: price.symbol,
      timestamp: new Date(),
      bollingerSqueeze: squeeze,
      rsiDivergence: divergence,
      overallSignal,
      confidence,
      riskScore: enhanced.quantRiskScore,
    };
  });

/**
 * Pure function to calculate overall trading signal
 * Combines multiple formula signals with weighted scoring
 */
const calculateOverallSignal = (
  squeeze: BollingerSqueezeSignal,
  divergence: RSIDivergenceSignal
): { overallSignal: QuantitativeAnalysis['overallSignal']; confidence: number } => {
  let score = 0; // -100 to +100 (negative = sell, positive = buy)
  let totalWeight = 0;
  
  // Bollinger Squeeze signal (weight: 40%)
  if (squeeze.isSqueezing) {
    const squeezeWeight = 40;
    const squeezeScore = squeeze.breakoutDirection === 'BULLISH' ? 1 :
                         squeeze.breakoutDirection === 'BEARISH' ? -1 : 0;
    score += squeezeScore * squeezeWeight * (squeeze.confidence / 100);
    totalWeight += squeezeWeight;
  }
  
  // RSI Divergence signal (weight: 60%)
  if (divergence.hasDivergence) {
    const divergenceWeight = 60;
    const divergenceScore = divergence.divergenceType === 'BULLISH' ? 1 :
                            divergence.divergenceType === 'BEARISH' ? -1 : 0;
    score += divergenceScore * divergenceWeight * (divergence.strength / 100);
    totalWeight += divergenceWeight;
  }
  
  // Normalize score
  const normalizedScore = totalWeight > 0 ? score / totalWeight : 0;
  
  // Determine signal
  const overallSignal: QuantitativeAnalysis['overallSignal'] =
    normalizedScore > 0.6 ? 'STRONG_BUY' :
    normalizedScore > 0.2 ? 'BUY' :
    normalizedScore < -0.6 ? 'STRONG_SELL' :
    normalizedScore < -0.2 ? 'SELL' :
    'NEUTRAL';
  
  // Calculate confidence (0-100)
  const confidence = Math.round(Math.abs(normalizedScore) * 100);
  
  return { overallSignal, confidence };
};

/**
 * Effect-based batch analysis for multiple cryptocurrencies
 */
export const analyzeBatch = (
  prices: ReadonlyArray<CryptoPrice>
): Effect.Effect<ReadonlyArray<QuantitativeAnalysis>> =>
  Effect.forEach(
    prices,
    (price) => analyzeWithFormulas(price),
    { concurrency: "unbounded" }
  );

/**
 * Effect-based filter for high-confidence signals
 */
export const filterHighConfidence = (
  analyses: ReadonlyArray<QuantitativeAnalysis>,
  minConfidence: number = 70
): Effect.Effect<ReadonlyArray<QuantitativeAnalysis>> =>
  Effect.sync(() =>
    analyses.filter((analysis) => analysis.confidence >= minConfidence)
  );

/**
 * Effect-based ranking by quality score
 * Quality = confidence - (riskScore / 2)
 */
export const rankByQuality = (
  analyses: ReadonlyArray<QuantitativeAnalysis>
): Effect.Effect<ReadonlyArray<QuantitativeAnalysis>> =>
  Effect.sync(() =>
    [...analyses].sort((a, b) => {
      const qualityA = a.confidence - (a.riskScore / 2);
      const qualityB = b.confidence - (b.riskScore / 2);
      return qualityB - qualityA;
    })
  );
