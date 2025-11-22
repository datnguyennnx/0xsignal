import { Effect, Context, Layer } from "effect";
import {
  CoinGeckoService,
  BubbleDetectionService,
  type CryptoBubbleAnalysis,
  type CryptoPrice,
} from "@0xsignal/shared";
import { CacheService } from "../../infrastructure/cache/cache.service";
import { Logger } from "../../infrastructure/logging/logger.service";
import { AnalysisError } from "../models/errors";
import { 
  calculateMetrics, 
  analyzeWithFormulas, 
  type QuantitativeAnalysis 
} from "../formulas";

// ============================================================================
// MARKET ANALYSIS SERVICE
// ============================================================================
// Unified service for crypto market analysis using quantitative formulas
// Replaces separate analysis/monitoring/calculations modules
// ============================================================================

export interface EnhancedAnalysis {
  readonly symbol: string;
  readonly bubbleAnalysis: CryptoBubbleAnalysis;
  readonly quantAnalysis: QuantitativeAnalysis;
  readonly combinedRiskScore: number;
  readonly recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  readonly timestamp: Date;
}

export interface MarketOverview {
  readonly totalAnalyzed: number;
  readonly bubblesDetected: number;
  readonly highRiskAssets: string[];
  readonly averageRiskScore: number;
  readonly timestamp: Date;
}

/**
 * Market Analysis Service Interface
 */
export interface MarketAnalysisService {
  readonly analyzeSymbol: (
    symbol: string
  ) => Effect.Effect<EnhancedAnalysis, AnalysisError>;
  
  readonly analyzeTopCryptos: (
    limit: number
  ) => Effect.Effect<ReadonlyArray<EnhancedAnalysis>, AnalysisError>;
  
  readonly getMarketOverview: () => Effect.Effect<MarketOverview, AnalysisError>;
  
  readonly getHighConfidenceSignals: (
    minConfidence?: number
  ) => Effect.Effect<ReadonlyArray<EnhancedAnalysis>, AnalysisError>;
}

/**
 * Service Tag for dependency injection
 */
export class MarketAnalysisServiceTag extends Context.Tag("MarketAnalysisService")<
  MarketAnalysisServiceTag,
  MarketAnalysisService
>() {}

// ============================================================================
// PURE FUNCTIONS
// ============================================================================

/**
 * Pure function to calculate combined risk score
 * Weights: 60% bubble score, 40% quant risk
 */
const calculateCombinedRisk = (
  bubbleScore: number,
  quantRisk: number
): number => {
  return Math.round((bubbleScore * 0.6) + (quantRisk * 0.4));
};

/**
 * Pure function to generate trading recommendation
 */
const generateRecommendation = (
  riskLevel: string,
  quantSignal: string,
  combinedRisk: number
): EnhancedAnalysis['recommendation'] => {
  // High risk = avoid buying
  if (combinedRisk > 80 || riskLevel === 'EXTREME') {
    return 'STRONG_SELL';
  }
  
  if (combinedRisk > 60 || riskLevel === 'HIGH') {
    return 'SELL';
  }
  
  // Low risk + bullish signal = buy
  if (combinedRisk < 30 && (quantSignal === 'STRONG_BUY' || quantSignal === 'BUY')) {
    return quantSignal === 'STRONG_BUY' ? 'STRONG_BUY' : 'BUY';
  }
  
  return 'HOLD';
};

/**
 * Pure function to create market overview from analyses
 */
const createMarketOverview = (
  analyses: ReadonlyArray<EnhancedAnalysis>
): MarketOverview => {
  const bubblesDetected = analyses.filter(
    (a) => a.bubbleAnalysis.isBubble
  ).length;
  
  const highRiskAssets = analyses
    .filter((a) => a.combinedRiskScore > 70)
    .map((a) => a.symbol);
  
  const averageRiskScore = analyses.length > 0
    ? Math.round(
        analyses.reduce((sum, a) => sum + a.combinedRiskScore, 0) / analyses.length
      )
    : 0;
  
  return {
    totalAnalyzed: analyses.length,
    bubblesDetected,
    highRiskAssets,
    averageRiskScore,
    timestamp: new Date(),
  };
};

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

/**
 * Live implementation of Market Analysis Service
 */
export const MarketAnalysisServiceLive = Layer.effect(
  MarketAnalysisServiceTag,
  Effect.gen(function* () {
    const coinGecko = yield* CoinGeckoService;
    const bubbleDetection = yield* BubbleDetectionService;
    const cache = yield* CacheService;
    const logger = yield* Logger;

    /**
     * Analyze single cryptocurrency with both bubble detection and quant formulas
     */
    const analyzeSymbol = (symbol: string): Effect.Effect<EnhancedAnalysis, AnalysisError> =>
      Effect.gen(function* () {
        // Check cache
        const cacheKey = `market-analysis-${symbol}`;
        const cached = yield* cache.get<EnhancedAnalysis>(cacheKey);
        
        if (cached) {
          yield* logger.debug(`Cache hit: ${symbol}`);
          return cached;
        }

        yield* logger.info(`Analyzing ${symbol.toUpperCase()}`);

        // Fetch price data
        const price = yield* coinGecko.getPrice(symbol);

        // Run both analyses in parallel
        const [bubbleAnalysis, quantAnalysis] = yield* Effect.all([
          Effect.gen(function* () {
            const metrics = calculateMetrics(price);
            return yield* bubbleDetection.analyzeBubble(price, metrics);
          }),
          analyzeWithFormulas(price),
        ], { concurrency: "unbounded" });

        // Calculate combined metrics
        const combinedRiskScore = calculateCombinedRisk(
          bubbleAnalysis.bubbleScore,
          quantAnalysis.riskScore
        );

        const recommendation = generateRecommendation(
          bubbleAnalysis.riskLevel,
          quantAnalysis.overallSignal,
          combinedRiskScore
        );

        const result: EnhancedAnalysis = {
          symbol: price.symbol,
          bubbleAnalysis,
          quantAnalysis,
          combinedRiskScore,
          recommendation,
          timestamp: new Date(),
        };

        yield* logger.info(
          `${symbol.toUpperCase()}: risk=${combinedRiskScore} rec=${recommendation}`
        );

        // Cache for 2 minutes
        yield* cache.set(cacheKey, result, 120000);

        return result;
      }).pipe(
        Effect.mapError(
          (error) =>
            new AnalysisError({
              message: `Failed to analyze ${symbol}: ${error}`,
              symbol,
            })
        )
      );

    /**
     * Analyze top N cryptocurrencies
     */
    const analyzeTopCryptos = (
      limit: number
    ): Effect.Effect<ReadonlyArray<EnhancedAnalysis>, AnalysisError> =>
      Effect.gen(function* () {
        // Check cache
        const cacheKey = `top-analysis-${limit}`;
        const cached = yield* cache.get<ReadonlyArray<EnhancedAnalysis>>(cacheKey);
        
        if (cached) {
          yield* logger.debug(`Cache hit: top ${limit}`);
          return cached;
        }

        yield* logger.info(`Analyzing top ${limit} cryptocurrencies`);

        // Fetch top cryptos
        const topCryptos = yield* coinGecko.getTopCryptos(limit);

        // Analyze each in parallel
        const analyses = yield* Effect.forEach(
          topCryptos,
          (price) =>
            Effect.gen(function* () {
              const [bubbleAnalysis, quantAnalysis] = yield* Effect.all([
                Effect.gen(function* () {
                  const metrics = calculateMetrics(price);
                  return yield* bubbleDetection.analyzeBubble(price, metrics);
                }),
                analyzeWithFormulas(price),
              ], { concurrency: "unbounded" });

              const combinedRiskScore = calculateCombinedRisk(
                bubbleAnalysis.bubbleScore,
                quantAnalysis.riskScore
              );

              const recommendation = generateRecommendation(
                bubbleAnalysis.riskLevel,
                quantAnalysis.overallSignal,
                combinedRiskScore
              );

              return {
                symbol: price.symbol,
                bubbleAnalysis,
                quantAnalysis,
                combinedRiskScore,
                recommendation,
                timestamp: new Date(),
              };
            }).pipe(
              Effect.catchAll(() =>
                Effect.succeed({
                  symbol: price.symbol,
                  bubbleAnalysis: {
                    symbol: price.symbol,
                    isBubble: false,
                    bubbleScore: 0,
                    signals: [],
                    riskLevel: "LOW" as const,
                    analysisTimestamp: new Date(),
                    nextCheckTime: new Date(Date.now() + 5 * 60 * 1000),
                  },
                  quantAnalysis: {
                    symbol: price.symbol,
                    timestamp: new Date(),
                    bollingerSqueeze: {
                      symbol: price.symbol,
                      isSqueezing: false,
                      bandwidth: 0,
                      squeezeIntensity: 0,
                      breakoutDirection: "NEUTRAL" as const,
                      confidence: 0,
                    },
                    rsiDivergence: {
                      symbol: price.symbol,
                      hasDivergence: false,
                      divergenceType: "NONE" as const,
                      strength: 0,
                      rsi: 50,
                      priceAction: "NEUTRAL" as const,
                    },
                    overallSignal: "NEUTRAL" as const,
                    confidence: 0,
                    riskScore: 0,
                  },
                  combinedRiskScore: 0,
                  recommendation: "HOLD" as const,
                  timestamp: new Date(),
                })
              )
            ),
          { concurrency: "unbounded" }
        );

        yield* logger.info(`Analyzed ${analyses.length} cryptocurrencies`);

        // Cache for 2 minutes
        yield* cache.set(cacheKey, analyses, 120000);

        return analyses;
      }).pipe(
        Effect.mapError(
          (error) =>
            new AnalysisError({
              message: `Failed to analyze top cryptos: ${error}`,
            })
        )
      );

    /**
     * Get market overview
     */
    const getMarketOverview = (): Effect.Effect<MarketOverview, AnalysisError> =>
      Effect.gen(function* () {
        // Check cache
        const cacheKey = "market-overview";
        const cached = yield* cache.get<MarketOverview>(cacheKey);
        
        if (cached) {
          yield* logger.debug("Cache hit: market overview");
          return cached;
        }

        const analyses = yield* analyzeTopCryptos(20);
        const overview = createMarketOverview(analyses);

        // Cache for 2 minutes
        yield* cache.set(cacheKey, overview, 120000);

        return overview;
      });

    /**
     * Get high confidence signals
     */
    const getHighConfidenceSignals = (
      minConfidence: number = 70
    ): Effect.Effect<ReadonlyArray<EnhancedAnalysis>, AnalysisError> =>
      Effect.gen(function* () {
        const analyses = yield* analyzeTopCryptos(50);
        
        return analyses.filter(
          (a) => a.quantAnalysis.confidence >= minConfidence
        );
      });

    return {
      analyzeSymbol,
      analyzeTopCryptos,
      getMarketOverview,
      getHighConfidenceSignals,
    };
  })
);
