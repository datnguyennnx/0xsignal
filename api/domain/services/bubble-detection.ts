import { Effect, Context, Layer } from "effect";
import type {
  CryptoPrice,
  MarketMetrics,
  BubbleSignal,
  BubbleIndicator,
  CryptoBubbleAnalysis,
} from "@0xsignal/shared";

export class BubbleDetectionService extends Context.Tag("BubbleDetectionService")<
  BubbleDetectionService,
  {
    readonly analyzeBubble: (
      price: CryptoPrice,
      metrics: MarketMetrics
    ) => Effect.Effect<CryptoBubbleAnalysis, never>;
    readonly detectPriceSpike: (
      price: CryptoPrice,
      historicalPrices?: CryptoPrice[]
    ) => Effect.Effect<BubbleSignal | null, never>;
    readonly detectVolumeSurge: (price: CryptoPrice) => Effect.Effect<BubbleSignal | null, never>;
    readonly detectATHApproach: (price: CryptoPrice) => Effect.Effect<BubbleSignal | null, never>;
    readonly detectVolatilitySpike: (
      metrics: MarketMetrics
    ) => Effect.Effect<BubbleSignal | null, never>;
    readonly detectExtremeDominance: (
      price: CryptoPrice,
      globalMetrics?: Record<string, unknown>
    ) => Effect.Effect<BubbleSignal | null, never>;
    readonly calculateBubbleScore: (signals: BubbleSignal[]) => Effect.Effect<number, never>;
  }
>() {}

// Bubble detection thresholds and algorithms
export const BUBBLE_THRESHOLDS = {
  PRICE_SPIKE: {
    change24h: 20, // 20% price increase
    volumeMultiplier: 3, // 3x normal volume
    severity: {
      low: 15,
      medium: 30,
      high: 50,
      critical: 100,
    },
  },
  VOLUME_SURGE: {
    volumeMultiplier: 5, // 5x normal volume
    marketCapRatio: 0.1, // 10% of market cap in volume
  },
  ATH_APPROACH: {
    athThreshold: 0.9, // Within 10% of all-time high
    athChangePercentage: -20, // ATH change % threshold
    timeFromATH: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
  },
  VOLATILITY_SPIKE: {
    volatilityThreshold: 0.8, // 80% volatility
    liquidityDrop: 0.3, // 30% liquidity drop
  },
  EXTREME_DOMINANCE: {
    dominanceThreshold: 15, // 15% market dominance
    marketCapThreshold: 50000000000, // $50B market cap
  },
} as const;

// Standalone detection functions
const detectPriceSpikeFn = (price: CryptoPrice): BubbleSignal | null => {
  const priceChangePercent = Math.abs(price.change24h);
  const volumeMultiplier = price.volume24h / (price.marketCap * 0.02); // Assuming 2% daily volume is normal

  const indicators: BubbleIndicator[] = [
    {
      name: "24h Price Change",
      value: priceChangePercent,
      threshold: BUBBLE_THRESHOLDS.PRICE_SPIKE.change24h,
      triggered: priceChangePercent >= BUBBLE_THRESHOLDS.PRICE_SPIKE.change24h,
      description: `${priceChangePercent.toFixed(2)}% change in 24h`,
    },
    {
      name: "Volume Multiplier",
      value: volumeMultiplier,
      threshold: BUBBLE_THRESHOLDS.PRICE_SPIKE.volumeMultiplier,
      triggered: volumeMultiplier >= BUBBLE_THRESHOLDS.PRICE_SPIKE.volumeMultiplier,
      description: `${volumeMultiplier.toFixed(2)}x normal volume`,
    },
  ];

  const triggeredIndicators = indicators.filter((i) => i.triggered);
  if (triggeredIndicators.length === 0) return null;

  // Calculate severity based on how many thresholds are exceeded
  const severityScore = triggeredIndicators.length * 25; // Max 100 for 4 indicators
  const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
    severityScore >= 75
      ? "CRITICAL"
      : severityScore >= 50
        ? "HIGH"
        : severityScore >= 25
          ? "MEDIUM"
          : "LOW";

  return {
    symbol: price.symbol,
    signalType: "PRICE_SPIKE",
    severity,
    confidence: Math.min(severityScore + 20, 100), // Base confidence on severity
    indicators,
    timestamp: new Date(),
    metadata: {
      priceChangePercent,
      volumeMultiplier,
      marketCap: price.marketCap,
      volume24h: price.volume24h,
    },
  } as BubbleSignal;
};

const detectVolumeSurgeFn = (price: CryptoPrice): BubbleSignal | null => {
  const volumeToMarketCapRatio = price.volume24h / price.marketCap;
  const volumeMultiplier = price.volume24h / (price.marketCap * 0.02); // Assuming 2% is normal

  const indicators: BubbleIndicator[] = [
    {
      name: "Volume to Market Cap Ratio",
      value: volumeToMarketCapRatio,
      threshold: BUBBLE_THRESHOLDS.VOLUME_SURGE.marketCapRatio,
      triggered: volumeToMarketCapRatio >= BUBBLE_THRESHOLDS.VOLUME_SURGE.marketCapRatio,
      description: `${(volumeToMarketCapRatio * 100).toFixed(2)}% of market cap traded`,
    },
    {
      name: "Volume Multiplier",
      value: volumeMultiplier,
      threshold: BUBBLE_THRESHOLDS.VOLUME_SURGE.volumeMultiplier,
      triggered: volumeMultiplier >= BUBBLE_THRESHOLDS.VOLUME_SURGE.volumeMultiplier,
      description: `${volumeMultiplier.toFixed(2)}x normal volume`,
    },
  ];

  const triggeredIndicators = indicators.filter((i) => i.triggered);
  if (triggeredIndicators.length === 0) return null;

  const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
    triggeredIndicators.length === 2
      ? "HIGH"
      : volumeToMarketCapRatio >= 0.2
        ? "CRITICAL"
        : "MEDIUM";

  return {
    symbol: price.symbol,
    signalType: "VOLUME_SURGE",
    severity,
    confidence: triggeredIndicators.length === 2 ? 85 : 65,
    indicators,
    timestamp: new Date(),
    metadata: {
      volumeToMarketCapRatio,
      volumeMultiplier,
      volume24h: price.volume24h,
      marketCap: price.marketCap,
    },
  } as BubbleSignal;
};

const detectATHApproachFn = (price: CryptoPrice): BubbleSignal | null => {
  if (!price.ath) return null;

  const priceToATHRatio = price.price / price.ath;
  const athChangePercentage = price.athChangePercentage || 0;

  const indicators: BubbleIndicator[] = [
    {
      name: "Price to ATH Ratio",
      value: priceToATHRatio,
      threshold: BUBBLE_THRESHOLDS.ATH_APPROACH.athThreshold,
      triggered: priceToATHRatio >= BUBBLE_THRESHOLDS.ATH_APPROACH.athThreshold,
      description: `${(priceToATHRatio * 100).toFixed(1)}% of all-time high`,
    },
    {
      name: "ATH Change Percentage",
      value: Math.abs(athChangePercentage),
      threshold: Math.abs(BUBBLE_THRESHOLDS.ATH_APPROACH.athChangePercentage),
      triggered: athChangePercentage <= BUBBLE_THRESHOLDS.ATH_APPROACH.athChangePercentage,
      description: `${athChangePercentage.toFixed(1)}% from ATH`,
    },
  ];

  const triggeredIndicators = indicators.filter((i) => i.triggered);
  if (triggeredIndicators.length === 0) return null;

  const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
    priceToATHRatio >= 0.98
      ? "CRITICAL"
      : priceToATHRatio >= 0.95
        ? "HIGH"
        : priceToATHRatio >= 0.92
          ? "MEDIUM"
          : "LOW";

  return {
    symbol: price.symbol,
    signalType: "ATH_APPROACH",
    severity,
    confidence: Math.min(priceToATHRatio * 100, 95),
    indicators,
    timestamp: new Date(),
    metadata: {
      priceToATHRatio,
      ath: price.ath,
      currentPrice: price.price,
      athChangePercentage,
    },
  } as BubbleSignal;
};

const detectExtremeDominanceFn = (
  price: CryptoPrice,
  globalMetrics?: Record<string, unknown>
): BubbleSignal | null => {
  // This would typically use global market data, but for now we'll use market cap as proxy
  const marketCapThreshold = BUBBLE_THRESHOLDS.EXTREME_DOMINANCE.marketCapThreshold;
  const dominanceThreshold = BUBBLE_THRESHOLDS.EXTREME_DOMINANCE.dominanceThreshold;

  const indicators: BubbleIndicator[] = [
    {
      name: "Market Cap Size",
      value: price.marketCap,
      threshold: marketCapThreshold,
      triggered: price.marketCap >= marketCapThreshold,
      description: `$${price.marketCap.toLocaleString()} market cap`,
    },
    {
      name: "Market Dominance",
      value: (globalMetrics?.marketDominance as number) || 0,
      threshold: dominanceThreshold,
      triggered: ((globalMetrics?.marketDominance as number) || 0) >= dominanceThreshold,
      description: `${(globalMetrics?.marketDominance as number) || 0}% market dominance`,
    },
  ];

  const triggeredIndicators = indicators.filter((i) => i.triggered);
  if (triggeredIndicators.length === 0) return null;

  const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
    price.marketCap >= marketCapThreshold * 2
      ? "CRITICAL"
      : price.marketCap >= marketCapThreshold
        ? "HIGH"
        : "MEDIUM";

  return {
    symbol: price.symbol,
    signalType: "EXTREME_DOMINANCE",
    severity,
    confidence: triggeredIndicators.length === 2 ? 90 : 75,
    indicators,
    timestamp: new Date(),
    metadata: {
      marketCap: price.marketCap,
      marketDominance: globalMetrics?.marketDominance || 0,
      marketCapThreshold,
      dominanceThreshold,
    },
  } as BubbleSignal;
};

const detectVolatilitySpikeFn = (metrics: MarketMetrics): BubbleSignal | null => {
  const indicators: BubbleIndicator[] = [
    {
      name: "Volatility Index",
      value: metrics.volatility,
      threshold: BUBBLE_THRESHOLDS.VOLATILITY_SPIKE.volatilityThreshold,
      triggered: metrics.volatility >= BUBBLE_THRESHOLDS.VOLATILITY_SPIKE.volatilityThreshold,
      description: `${(metrics.volatility * 100).toFixed(1)}% volatility`,
    },
    {
      name: "Liquidity Score",
      value: metrics.liquidityScore,
      threshold: BUBBLE_THRESHOLDS.VOLATILITY_SPIKE.liquidityDrop,
      triggered: metrics.liquidityScore <= BUBBLE_THRESHOLDS.VOLATILITY_SPIKE.liquidityDrop,
      description: `${(metrics.liquidityScore * 100).toFixed(1)}% liquidity score`,
    },
  ];

  const triggeredIndicators = indicators.filter((i) => i.triggered);
  if (triggeredIndicators.length === 0) return null;

  const severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
    triggeredIndicators.length === 2 ? "CRITICAL" : metrics.volatility >= 1.0 ? "HIGH" : "MEDIUM";

  return {
    symbol: metrics.symbol,
    signalType: "VOLATILITY_SPIKE",
    severity,
    confidence: triggeredIndicators.length === 2 ? 90 : 70,
    indicators,
    timestamp: new Date(),
    metadata: {
      volatility: metrics.volatility,
      liquidityScore: metrics.liquidityScore,
    },
  } as BubbleSignal;
};

const calculateBubbleScoreFn = (signals: BubbleSignal[]): number => {
  if (signals.length === 0) return 0;

  // Weight different signal types
  const weights = {
    PRICE_SPIKE: 0.35,
    VOLUME_SURGE: 0.25,
    ATH_APPROACH: 0.3,
    VOLATILITY_SPIKE: 0.2,
    EXTREME_DOMINANCE: 0.15,
  };

  // Severity multipliers
  const severityMultipliers = {
    LOW: 0.3,
    MEDIUM: 0.6,
    HIGH: 0.8,
    CRITICAL: 1.0,
  };

  let totalScore = 0;
  let totalWeight = 0;

  for (const signal of signals) {
    const weight = weights[signal.signalType] || 0.2;
    const severityMultiplier = severityMultipliers[signal.severity];
    const signalScore = signal.confidence * severityMultiplier * weight;

    totalScore += signalScore;
    totalWeight += weight;
  }

  // Normalize to 0-100 scale
  return Math.min(Math.round((totalScore / Math.max(totalWeight, 1)) * 100), 100);
};

export const BubbleDetectionServiceLive = Layer.succeed(BubbleDetectionService, {
  analyzeBubble: (price, metrics) =>
    Effect.gen(function* () {
      // Run all detection algorithms in parallel
      const [priceSignal, volumeSignal, athSignal, volatilitySignal, dominanceSignal] =
        yield* Effect.all(
          [
            Effect.sync(() => detectPriceSpikeFn(price)),
            Effect.sync(() => detectVolumeSurgeFn(price)),
            Effect.sync(() => detectATHApproachFn(price)),
            Effect.sync(() => detectVolatilitySpikeFn(metrics)),
            Effect.sync(() => detectExtremeDominanceFn(price)),
          ],
          { concurrency: "unbounded" }
        );

      // Collect all signals
      const signals = [
        priceSignal,
        volumeSignal,
        athSignal,
        volatilitySignal,
        dominanceSignal,
      ].filter((signal): signal is BubbleSignal => signal !== null);

      // Calculate overall bubble score
      const bubbleScore = calculateBubbleScoreFn(signals);

      // Determine risk level based on score and signal types
      const hasCriticalSignals = signals.some((s) => s.severity === "CRITICAL");
      const hasHighSeveritySignals = signals.some((s) => s.severity === "HIGH");

      const riskLevel =
        bubbleScore >= 80 || hasCriticalSignals
          ? "EXTREME"
          : bubbleScore >= 60 || hasHighSeveritySignals
            ? "HIGH"
            : bubbleScore >= 40
              ? "MEDIUM"
              : "LOW";

      return {
        symbol: price.symbol,
        isBubble: bubbleScore >= 50 || hasCriticalSignals, // Consider it a bubble if score >= 50 or has critical signals
        bubbleScore,
        signals,
        riskLevel,
        analysisTimestamp: new Date(),
        nextCheckTime: new Date(Date.now() + 5 * 60 * 1000), // Check again in 5 minutes
      } as CryptoBubbleAnalysis;
    }),

  detectPriceSpike: (price) => Effect.sync(() => detectPriceSpikeFn(price)),

  detectVolumeSurge: (price) => Effect.sync(() => detectVolumeSurgeFn(price)),

  detectATHApproach: (price) => Effect.sync(() => detectATHApproachFn(price)),

  detectVolatilitySpike: (metrics) => Effect.sync(() => detectVolatilitySpikeFn(metrics)),

  detectExtremeDominance: (price, globalMetrics) =>
    Effect.sync(() => detectExtremeDominanceFn(price, globalMetrics)),

  calculateBubbleScore: (signals) => Effect.sync(() => calculateBubbleScoreFn(signals)),
});
