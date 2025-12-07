/** Asset Analyzer - Uses real historical OHLCV data for all calculations */

import { Effect, Match, Array as Arr, pipe } from "effect";
import type { CryptoPrice, ChartDataPoint } from "@0xsignal/shared";
import type { AssetAnalysis, Signal, CrashSignal } from "../domain/types";
import { computeIndicators } from "../domain/analysis/indicators";
import type { IndicatorOutput } from "../domain/analysis/indicator-types";
import { findEntryWithIndicators } from "./find-entries";
import { calculateNoiseScore } from "../domain/formulas/statistical/noise";
import { calculateRiskScore, scoreToSignal } from "../domain/analysis/scoring";
import { ChartDataService } from "../infrastructure/data-sources/binance";

const KLINE_PERIODS = 168; // 7 days of hourly data for sparklines & indicators

type IndicatorSignal = { signal: "BUY" | "SELL" | "NEUTRAL"; weight: number };
type MarketRegime =
  | "HIGH_VOLATILITY"
  | "LOW_VOLATILITY"
  | "BULL_MARKET"
  | "BEAR_MARKET"
  | "TRENDING"
  | "SIDEWAYS"
  | "MEAN_REVERSION";

const signalToAction = Match.type<Signal>().pipe(
  Match.when("STRONG_BUY", () => "Strong buy opportunity. Consider entering position."),
  Match.when("BUY", () => "Buy signal. Consider smaller position or DCA."),
  Match.when("HOLD", () => "Hold current positions. Wait for clearer signals."),
  Match.when("SELL", () => "Consider taking profits or reducing exposure."),
  Match.when("STRONG_SELL", () => "Exit positions. Protect capital."),
  Match.exhaustive
);

const normalizeSymbol = (s: string): string => {
  const upper = s.toUpperCase();
  return upper.endsWith("USDT") ? upper : `${upper}USDT`;
};

// Detect market regime from REAL indicators
const detectRegime = (indicators: IndicatorOutput, change24h: number): MarketRegime =>
  pipe(
    Match.value({ atr: indicators.atr.normalized, adx: indicators.adx.value, change: change24h }),
    Match.when(
      ({ atr }) => atr > 8,
      () => "HIGH_VOLATILITY" as MarketRegime
    ),
    Match.when(
      ({ atr }) => atr < 1.5,
      () => "LOW_VOLATILITY" as MarketRegime
    ),
    Match.when(
      ({ adx, change }) => adx > 40 && change > 5,
      () => "BULL_MARKET" as MarketRegime
    ),
    Match.when(
      ({ adx, change }) => adx > 40 && change < -5,
      () => "BEAR_MARKET" as MarketRegime
    ),
    Match.when(
      ({ adx }) => adx > 35,
      () => "TRENDING" as MarketRegime
    ),
    Match.when(
      ({ adx }) => adx < 20,
      () => "SIDEWAYS" as MarketRegime
    ),
    Match.orElse(() => "MEAN_REVERSION" as MarketRegime)
  );

// Convert RSI to signal using standard thresholds
const rsiToSignal = Match.type<number>().pipe(
  Match.when(
    (r) => r < 35,
    () => "BUY" as const
  ),
  Match.when(
    (r) => r > 65,
    () => "SELL" as const
  ),
  Match.orElse(() => "NEUTRAL" as const)
);

// Convert MACD to signal
const macdToSignal = (macd: number, histogram: number): "BUY" | "SELL" | "NEUTRAL" => {
  if (macd > 0 && histogram > 0) return "BUY";
  if (macd < 0 && histogram < 0) return "SELL";
  return "NEUTRAL";
};

// Convert ADX direction to signal
const adxToSignal = (plusDI: number, minusDI: number, adx: number): "BUY" | "SELL" | "NEUTRAL" => {
  if (adx < 20) return "NEUTRAL";
  if (plusDI > minusDI + 5) return "BUY";
  if (minusDI > plusDI + 5) return "SELL";
  return "NEUTRAL";
};

// Calculate weighted signal score
const calculateScore = (signals: IndicatorSignal[]): number =>
  signals.reduce(
    (score, { signal, weight }) =>
      score + (signal === "BUY" ? weight : signal === "SELL" ? -weight : 0),
    0
  );

// Calculate indicator agreement percentage
const calculateAgreement = (signals: IndicatorSignal[]): number => {
  const buyCount = signals.filter((s) => s.signal === "BUY").length;
  const sellCount = signals.filter((s) => s.signal === "SELL").length;
  const dominant = Math.max(buyCount, sellCount);
  return signals.length > 0 ? dominant / signals.length : 0;
};

// Calculate confidence from real indicator data
const calculateConfidence = (
  score: number,
  agreement: number,
  adx: number,
  atr: number
): number => {
  const baseConfidence = Math.min(Math.abs(score), 100);
  const trendBonus = adx > 30 ? 15 : adx > 20 ? 5 : 0;
  const volatilityPenalty = atr > 6 ? -15 : atr > 4 ? -5 : 0;
  const agreementBonus = agreement > 0.75 ? 15 : agreement > 0.5 ? 5 : -10;
  return Math.max(
    0,
    Math.min(100, baseConfidence + trendBonus + volatilityPenalty + agreementBonus)
  );
};

// Build reasoning from real indicator values
const buildReasoning = (indicators: IndicatorOutput, agreement: number): string => {
  const parts: string[] = [];
  const agreementPct = Math.round(agreement * 100);

  parts.push(
    agreementPct >= 75
      ? `Strong indicator alignment (${agreementPct}%)`
      : agreementPct >= 50
        ? `Moderate consensus (${agreementPct}%)`
        : `Mixed signals (${agreementPct}%)`
  );

  const rsi = indicators.rsi.value;
  if (rsi < 30) parts.push(`RSI oversold (${Math.round(rsi)})`);
  else if (rsi > 70) parts.push(`RSI overbought (${Math.round(rsi)})`);

  if (indicators.macd.crossover === "BULLISH_CROSS") parts.push("MACD bullish crossover");
  else if (indicators.macd.crossover === "BEARISH_CROSS") parts.push("MACD bearish crossover");

  if (indicators.adx.value > 40)
    parts.push(`Strong trend (ADX ${Math.round(indicators.adx.value)})`);
  else if (indicators.adx.value < 20) parts.push("Weak/ranging market");

  parts.push(`Based on ${indicators.dataPoints} hourly candles`);

  return parts.join(". ");
};

// Detect crash conditions from REAL indicators
const detectCrash = (indicators: IndicatorOutput, price: CryptoPrice): CrashSignal => {
  const crashIndicators = {
    rapidDrop: price.change24h < -15,
    volumeSpike: false, // Would need volume comparison
    oversoldExtreme: indicators.rsi.value < 20,
    highVolatility: indicators.atr.normalized > 8,
  };

  const activeCount = Object.values(crashIndicators).filter(Boolean).length;
  const isCrashing = activeCount >= 2;

  const severity =
    activeCount >= 4
      ? ("EXTREME" as const)
      : activeCount >= 3
        ? ("HIGH" as const)
        : activeCount >= 2
          ? ("MEDIUM" as const)
          : ("LOW" as const);

  const recommendation = isCrashing
    ? `CRASH WARNING: ${activeCount} indicators triggered. Consider reducing exposure.`
    : "No crash detected. Normal market conditions.";

  return {
    isCrashing,
    severity,
    confidence: Math.round((activeCount / 4) * 100),
    indicators: crashIndicators,
    recommendation,
  };
};

export const analyzeAsset = (
  price: CryptoPrice
): Effect.Effect<AssetAnalysis, never, ChartDataService> =>
  Effect.gen(function* () {
    const chartService = yield* ChartDataService;
    const binanceSymbol = normalizeSymbol(price.symbol);

    // Fetch historical data (Parallel fetch for Analysis & Sparkline)
    const [ohlcv, dailyHistory] = yield* Effect.all(
      [
        // 1h data for analysis (indicators) - 168 periods (7 days)
        chartService
          .getHistoricalData(binanceSymbol, "1h", 168)
          .pipe(Effect.catchAll(() => Effect.succeed([] as ChartDataPoint[]))),
        // 1d data for sparkline - 365 periods (1 year)
        chartService
          .getHistoricalData(binanceSymbol, "1d", 365)
          .pipe(Effect.catchAll(() => Effect.succeed([] as ChartDataPoint[]))),
      ],
      { concurrency: 2 }
    );

    // Compute REAL indicators from hourly data
    const indicators = yield* computeIndicators(ohlcv as ChartDataPoint[]);

    // Handle insufficient data case
    if (!indicators.isValid) {
      const neutralSignal = {
        direction: "NEUTRAL" as const,
        isOptimalEntry: false,
        strength: "WEAK" as const,
        confidence: 0,
        indicators: {
          trendReversal: false,
          volumeIncrease: false,
          momentumBuilding: false,
          divergence: false,
        },
        entryPrice: price.price,
        targetPrice: price.price,
        stopLoss: price.price,
        riskRewardRatio: 0,
        suggestedLeverage: 1,
        maxLeverage: 1,
        indicatorSummary: {
          rsi: { value: 50, signal: "NEUTRAL" as const },
          macd: { trend: "NEUTRAL" as const, histogram: 0 },
          adx: { value: 25, strength: "WEAK" as const },
          atr: { value: 0, volatility: "NORMAL" as const },
        },
        dataSource: "INSUFFICIENT_DATA" as const,
        recommendation: `Insufficient data (${indicators.dataPoints} periods). Need 35+ for reliable signals.`,
      };

      return {
        symbol: price.symbol,
        timestamp: new Date(),
        price,
        strategyResult: {
          regime: "SIDEWAYS" as const,
          signals: [],
          primarySignal: {
            strategy: "INSUFFICIENT_DATA",
            signal: "HOLD" as const,
            confidence: 0,
            reasoning: `Only ${indicators.dataPoints} periods available. Minimum 35 required.`,
            metrics: { dataPoints: indicators.dataPoints },
          },
          overallConfidence: 0,
          riskScore: 50,
        },
        crashSignal: detectCrash(indicators, price),
        entrySignal: neutralSignal,
        overallSignal: "HOLD" as Signal,
        confidence: 0,
        riskScore: 50,
        noise: { value: 50, level: "MODERATE" as const },
        recommendation: "Insufficient historical data for reliable analysis.",
        sparkline: [],
      };
    }

    // Calculate regime from REAL indicators
    const regime = detectRegime(indicators, price.change24h);

    // Build signal array with weights (quant approach)
    const signals: IndicatorSignal[] = [
      { signal: rsiToSignal(indicators.rsi.value), weight: 30 },
      { signal: macdToSignal(indicators.macd.macd, indicators.macd.histogram), weight: 30 },
      {
        signal: adxToSignal(indicators.adx.plusDI, indicators.adx.minusDI, indicators.adx.value),
        weight: 25,
      },
      {
        signal: price.change24h > 1 ? "BUY" : price.change24h < -1 ? "SELL" : "NEUTRAL",
        weight: 15,
      },
    ];

    const agreement = calculateAgreement(signals);
    const score = calculateScore(signals);
    const confidence = calculateConfidence(
      score,
      agreement,
      indicators.adx.value,
      indicators.atr.normalized
    );
    const overallSignal = scoreToSignal(score);
    const riskScore = calculateRiskScore(regime, confidence, indicators.atr.normalized, agreement);

    // Build strategy result
    const strategyResult = {
      regime,
      signals: [],
      primarySignal: {
        strategy: "QUANTITATIVE",
        signal: overallSignal,
        confidence,
        reasoning: buildReasoning(indicators, agreement),
        metrics: {
          rsi: indicators.rsi.value,
          macd: indicators.macd.macd,
          macdHistogram: indicators.macd.histogram,
          adx: indicators.adx.value,
          plusDI: indicators.adx.plusDI,
          minusDI: indicators.adx.minusDI,
          atr: indicators.atr.value,
          normalizedATR: indicators.atr.normalized,
          indicatorAgreement: Math.round(agreement * 100),
          dataPoints: indicators.dataPoints,
        },
      },
      overallConfidence: confidence,
      riskScore,
    };

    // Find entry using REAL indicator data
    const entrySignal = yield* findEntryWithIndicators(
      price,
      indicators,
      overallSignal,
      confidence
    );

    // Calculate noise score from real data
    const noise = calculateNoiseScore(indicators.adx.value, indicators.atr.normalized, agreement);

    // Build final recommendation
    const recommendation = pipe(
      [
        `Market Regime: ${regime}`,
        entrySignal.recommendation,
        buildReasoning(indicators, agreement),
        signalToAction(overallSignal),
      ],
      Arr.filter((x): x is string => x !== null && x !== ""),
      Arr.join(". ")
    );

    return {
      symbol: price.symbol,
      timestamp: new Date(),
      price,
      strategyResult,
      crashSignal: detectCrash(indicators, price),
      entrySignal,
      overallSignal,
      confidence,
      riskScore,
      noise,
      recommendation,
      sparkline: (dailyHistory as ChartDataPoint[]).map((c) => c.close),
    };
  });
