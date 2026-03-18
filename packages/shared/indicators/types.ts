/**
 * Indicator types - shared between frontend and backend
 */

export type IndicatorCategory =
  | "trend"
  | "momentum"
  | "volatility"
  | "volume"
  | "adaptive"
  | "regime"
  | "hybrid"
  | "cycle"
  | "moneyflow";

export type IndicatorOutputType = "line" | "band" | "histogram" | "dots" | "custom";

export type IndicatorParamControl = "int" | "float";

export interface IndicatorParamDefinition {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly control: IndicatorParamControl;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface IndicatorUsageInfo {
  readonly whatItDoes: string;
  readonly whenToUse: string;
  readonly formula?: string; // LaTeX format
  readonly mathematicalWeaknesses?: string;
  readonly regimePerformance?: string;
  readonly comparisons?: string;
  readonly upgrades?: string;
  readonly tips?: readonly string[];
  readonly pitfalls?: readonly string[];
}

export interface IndicatorConfig {
  readonly id: string;
  readonly name: string;
  readonly category: IndicatorCategory;
  readonly description: string; // shortDescription
  readonly defaultParams: Record<string, number>;
  readonly params: readonly IndicatorParamDefinition[];
  readonly usage: IndicatorUsageInfo;
  readonly output: IndicatorOutputType;
  readonly allowMultiple: boolean;
  readonly overlayOnPrice: boolean;
  readonly paneIndexRecommendation?: number | string;
  readonly implementationNotesForDev?: string;
}

export interface ActiveIndicator {
  readonly instanceId: string;
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
