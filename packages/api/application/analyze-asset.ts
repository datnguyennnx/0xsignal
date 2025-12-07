/** Asset Analyzer - Uses real historical OHLCV data for all calculations */

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { CryptoPrice, ChartDataPoint } from "@0xsignal/shared";
import type { AssetAnalysis, Signal } from "../domain/types";
import { computeIndicators } from "../domain/analysis/indicators";
import type { IndicatorOutput } from "../domain/analysis/indicator-types";
import { findEntryWithIndicators } from "./find-entries";
import { calculateNoiseScore } from "../domain/formulas/statistical/noise";
import { calculateRiskScore } from "../domain/analysis/scoring";
import { ChartDataService } from "../infrastructure/data-sources/binance";

// Analysis configuration
const KLINE_PERIODS = 168; // 7 days of 1h data
const SPARKLINE_PERIODS = 365; // 1 year of 1d data

type MarketRegime = "TRENDING_BULL" | "TRENDING_BEAR" | "RANGING" | "VOLATILE" | "UNDEFINED";

const normalizeSymbol = (s: string): string => {
  const upper = s.toUpperCase();
  return upper.endsWith("USDT") ? upper : `${upper}USDT`;
};

// Advanced Regime Detection
const detectRegime = (indicators: IndicatorOutput): MarketRegime => {
  const { adx, atr, rsi, macd } = indicators;

  // Normalized ATR > 5 is considered high volatility in this normalized context (0-100 scale)
  if (atr.normalized > 8) return "VOLATILE";

  if (adx.value > 25) {
    // Trend direction confirmation using EMA/MACD alignment
    if (macd.macd > macd.signal && rsi.value > 50) return "TRENDING_BULL";
    if (macd.macd < macd.signal && rsi.value < 50) return "TRENDING_BEAR";
  }

  if (adx.value < 20) return "RANGING";

  return "UNDEFINED";
};

// Dynamic Scoring Strategy based on Regime
const evaluateSignal = (
  indicators: IndicatorOutput,
  regime: MarketRegime
): { signal: Signal; confidence: number; reasoning: string } => {
  const { rsi, macd, adx } = indicators;

  // Strategy: Trend Following
  if (regime === "TRENDING_BULL") {
    // In strong uptrend, ignore Overbought RSI, buy on dips or momentum
    if (macd.histogram > 0 && rsi.value > 40 && rsi.value < 85) {
      const strength = adx.value > 40 ? "STRONG_BUY" : "BUY";
      return {
        signal: strength,
        confidence: Math.min(85 + adx.value / 2, 98),
        reasoning: `Strong Bullish Trend (ADX ${adx.value.toFixed(0)}). Momentum aligns with trend.`,
      };
    }
    // Pullback opportunity (Dip Buy)
    if (rsi.value < 45 && rsi.value > 30) {
      return {
        signal: "BUY",
        confidence: 75,
        reasoning: "Bullish trend healthy pullback. Potential entry zone.",
      };
    }
    if (macd.histogram < 0) {
      return {
        signal: "HOLD",
        confidence: 60,
        reasoning: "Bullish trend but losing momentum (Histogram negative).",
      };
    }
  }

  // Strategy: Trend Following Short
  if (regime === "TRENDING_BEAR") {
    if (macd.histogram < 0 && rsi.value < 60 && rsi.value > 15) {
      const strength = adx.value > 40 ? "STRONG_SELL" : "SELL";
      return {
        signal: strength,
        confidence: Math.min(85 + adx.value / 2, 98),
        reasoning: `Strong Bearish Trend (ADX ${adx.value.toFixed(0)}). Momentum aligns with trend.`,
      };
    }
    // Oversold bounce risks
    if (rsi.value < 25) {
      return {
        signal: "HOLD",
        confidence: 40,
        reasoning: "Bearish trend but Extreme Oversold. Wait for bounce to Sell.",
      };
    }
  }

  // Strategy: Mean Reversion (Ranging)
  if (regime === "RANGING") {
    if (rsi.value > 70) {
      return {
        signal: "SELL",
        confidence: 75,
        reasoning: "Ranging Market: RSI Overbought (>70). Expect reversion.",
      };
    }
    if (rsi.value < 30) {
      return {
        signal: "BUY",
        confidence: 75,
        reasoning: "Ranging Market: RSI Oversold (<30). Expect reversion.",
      };
    }
    if (macd.crossover === "BULLISH_CROSS") {
      return {
        signal: "BUY",
        confidence: 60,
        reasoning: "Range bound MACD crossover. Weak buy signal.",
      };
    }
    return { signal: "HOLD", confidence: 50, reasoning: "Choppy ranging market. No clear edge." };
  }

  // Strategy: Volatility Protection
  if (regime === "VOLATILE") {
    return {
      signal: "HOLD",
      confidence: 50,
      reasoning: "High Volatility detected. Markets unpredictable. Cash is a position.",
    };
  }

  // Default
  return {
    signal: "HOLD",
    confidence: 50,
    reasoning: "Mixed signals or undefined regime. No clear edge.",
  };
};

export const analyzeAsset = (
  price: CryptoPrice
): Effect.Effect<AssetAnalysis, never, ChartDataService> =>
  Effect.gen(function* () {
    const chartService = yield* ChartDataService;
    const binanceSymbol = normalizeSymbol(price.symbol);

    // Parallel fetch: Analysis Data (1h) + Sparkline (1d)
    const [ohlcv, dailyHistory] = yield* Effect.all(
      [
        chartService
          .getHistoricalData(binanceSymbol, "1h", KLINE_PERIODS)
          .pipe(Effect.catchAll(() => Effect.succeed([] as ChartDataPoint[]))),
        chartService
          .getHistoricalData(binanceSymbol, "1d", SPARKLINE_PERIODS)
          .pipe(Effect.catchAll(() => Effect.succeed([] as ChartDataPoint[]))),
      ],
      { concurrency: 2 }
    );

    // Handle Insufficient Data
    if (ohlcv.length < 50) {
      return {
        symbol: price.symbol,
        timestamp: new Date(),
        price,
        overallSignal: "HOLD" as Signal,
        confidence: 0,
        riskScore: 50,
        strategyResult: {
          regime: "SIDEWAYS",
          signals: [],
          primarySignal: {
            strategy: "INSUFFICIENT" as any,
            signal: "HOLD",
            confidence: 0,
            reasoning: `Insufficient data (${ohlcv.length} periods). Need 50+.`,
            metrics: { dataPoints: ohlcv.length } as any,
          },
          overallConfidence: 0,
          riskScore: 50,
        },

        entrySignal: {
          direction: "NEUTRAL",
          strength: "WEAK",
          confidence: 0,
          recommendation: "No Data",
          isOptimalEntry: false,
          entryPrice: 0,
          targetPrice: 0,
          stopLoss: 0,
          riskRewardRatio: 0,
          suggestedLeverage: 1,
          maxLeverage: 1,
          indicators: {
            trendReversal: false,
            volumeIncrease: false,
            momentumBuilding: false,
            divergence: false,
          },
          indicatorSummary: {
            rsi: { value: 50, signal: "NEUTRAL" },
            macd: { trend: "NEUTRAL", histogram: 0 },
            adx: { value: 0, strength: "WEAK" },
            atr: { value: 0, volatility: "NORMAL" },
          },
          dataSource: "INSUFFICIENT_DATA",
        },
        noise: { score: 0, value: 0, level: "LOW" },
        recommendation: "Insufficient Data",
        sparkline: [],
      };
    }

    const indicators = yield* computeIndicators(ohlcv as ChartDataPoint[]);

    // 1. Detect Regime (Core Quant Logic)
    const regime = detectRegime(indicators);

    // 2. Evaluate Strategy based on Regime
    const evaluation = evaluateSignal(indicators, regime);

    // 3. Risk Calculation
    // Map internal regime to shared types if needed, or update types.
    // Using mapping for compatibility with existing shared types
    const regimeMap: Record<MarketRegime, any> = {
      TRENDING_BULL: "BULL_MARKET",
      TRENDING_BEAR: "BEAR_MARKET",
      RANGING: "SIDEWAYS",
      VOLATILE: "HIGH_VOLATILITY",
      UNDEFINED: "SIDEWAYS",
    };

    const riskScore = calculateRiskScore(
      regimeMap[regime],
      evaluation.confidence,
      indicators.atr.normalized,
      0.5 // agreement derived from single strategy
    );

    // 4. Entry Analysis
    const entrySignal = yield* findEntryWithIndicators(
      price,
      indicators,
      evaluation.signal,
      evaluation.confidence
    );

    const noise = calculateNoiseScore(indicators.adx.value, indicators.atr.normalized, 0.8);

    const strategyResult = {
      regime: regimeMap[regime],
      signals: [],
      primarySignal: {
        strategy: "REGIME_QUANT",
        signal: evaluation.signal,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        metrics: {
          rsi: indicators.rsi.value,
          adx: indicators.adx.value,
          atr: indicators.atr.value,
        },
      },
      overallConfidence: evaluation.confidence,
      riskScore,
    };

    return {
      symbol: price.symbol,
      timestamp: new Date(),
      price,
      strategyResult,
      entrySignal,
      overallSignal: evaluation.signal,
      confidence: evaluation.confidence,
      riskScore,
      noise,
      recommendation: evaluation.reasoning,
      sparkline: (dailyHistory as ChartDataPoint[]).map((c) => c.close),
    };
  });
