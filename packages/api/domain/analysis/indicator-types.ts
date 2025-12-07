/** Indicator Input - Data required for technical analysis */

import type { ChartDataPoint, CryptoPrice } from "@0xsignal/shared";

export interface IndicatorInput {
  readonly symbol: string;
  readonly spotPrice: CryptoPrice;
  readonly ohlcv: readonly ChartDataPoint[];
  readonly dataPoints: number;
}

export interface IndicatorOutput {
  readonly rsi: RSIOutput;
  readonly macd: MACDOutput;
  readonly adx: ADXOutput;
  readonly atr: ATROutput;
  readonly isValid: boolean;
  readonly dataPoints: number;
}

export interface RSIOutput {
  readonly value: number;
  readonly signal: "OVERSOLD" | "NEUTRAL" | "OVERBOUGHT";
  readonly avgGain: number;
  readonly avgLoss: number;
}

export interface MACDOutput {
  readonly macd: number;
  readonly signal: number;
  readonly histogram: number;
  readonly crossover: "BULLISH_CROSS" | "BEARISH_CROSS" | "NONE";
  readonly trend?: "BULLISH" | "BEARISH" | "NEUTRAL";
}

export interface ADXOutput {
  readonly value: number;
  readonly plusDI: number;
  readonly minusDI: number;
  readonly trend: "STRONG" | "MODERATE" | "WEAK" | "NONE";
}

export interface ATROutput {
  readonly value: number;
  readonly normalized: number;
  readonly volatility: "HIGH" | "MEDIUM" | "LOW";
}

/** Legacy IndicatorSet for backward compatibility */
export interface IndicatorSet {
  readonly rsi: { rsi: number; signal: string; momentum: number };
  readonly macd: { macd: number; signal: number; histogram: number; trend: string };
  readonly adx: { adx: number; trendStrength: string; direction: string };
  readonly atr: { atr: number; normalizedATR: number; volatilityLevel: string };
  readonly divergence: { hasDivergence: boolean; type: string; divergenceType?: string };
  readonly volumeROC?: { value: number };
}

export const extractOHLC = (data: readonly ChartDataPoint[]) => ({
  opens: data.map((d) => d.open),
  highs: data.map((d) => d.high),
  lows: data.map((d) => d.low),
  closes: data.map((d) => d.close),
  volumes: data.map((d) => d.volume),
});

export const MIN_PERIODS_RSI = 15;
export const MIN_PERIODS_MACD = 35;
export const MIN_PERIODS_ADX = 28;
export const MIN_PERIODS_ATR = 15;
export const MIN_PERIODS_ANALYSIS = 35;
