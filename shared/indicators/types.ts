/**
 * Indicator types - shared between frontend and backend
 */

export type IndicatorCategory = "trend" | "momentum" | "volatility" | "volume" | "oscillators";

export interface IndicatorConfig {
  readonly id: string;
  readonly name: string;
  readonly category: IndicatorCategory;
  readonly description: string;
  readonly defaultParams?: Record<string, number>;
  readonly overlayOnPrice: boolean;
}

export interface ActiveIndicator {
  readonly config: IndicatorConfig;
  readonly params: Record<string, number>;
  readonly visible: boolean;
  readonly color?: string;
}

/**
 * Indicator data point for line series
 */
export interface IndicatorDataPoint {
  readonly time: number; // Unix timestamp
  readonly value: number;
}

/**
 * Band indicator data point (Bollinger, Keltner, Donchian)
 */
export interface BandIndicatorDataPoint {
  readonly time: number;
  readonly upper: number;
  readonly middle: number;
  readonly lower: number;
}

/**
 * MACD indicator result
 */
export interface MACDResult {
  readonly macd: IndicatorDataPoint[];
  readonly signal: IndicatorDataPoint[];
  readonly histogram: IndicatorDataPoint[];
}

/**
 * Stochastic indicator result
 */
export interface StochasticResult {
  readonly k: IndicatorDataPoint[];
  readonly d: IndicatorDataPoint[];
}
