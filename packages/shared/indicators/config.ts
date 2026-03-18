import type { IndicatorConfig } from "./types";
import { TREND_INDICATORS } from "./catalog/trend";
import { MOMENTUM_INDICATORS } from "./catalog/momentum";
import { VOLATILITY_INDICATORS } from "./catalog/volatility";
import { VOLUME_INDICATORS } from "./catalog/volume";
import { STATISTICS_INDICATORS } from "./catalog/statistics";
import { REGIME_INDICATORS } from "./catalog/regime";
import { ADVANCED_INDICATORS } from "./catalog/advanced";
import { QUANT_INDICATORS } from "./catalog/quant";

// Re-export types for convenience
export type {
  IndicatorConfig,
  ActiveIndicator,
  IndicatorCategory,
  IndicatorOutputType,
  IndicatorParamDefinition,
  IndicatorUsageInfo,
} from "./types";

export const AVAILABLE_INDICATORS: IndicatorConfig[] = [
  ...TREND_INDICATORS,
  ...VOLATILITY_INDICATORS,
  ...MOMENTUM_INDICATORS,
  ...VOLUME_INDICATORS,
  ...STATISTICS_INDICATORS,
  ...REGIME_INDICATORS,
  ...ADVANCED_INDICATORS,
  ...QUANT_INDICATORS,
];

const INDICATOR_MAP = new Map(AVAILABLE_INDICATORS.map((indicator) => [indicator.id, indicator]));

const quantize = (value: number, step: number): number => {
  const decimals = step.toString().includes(".") ? step.toString().split(".")[1].length : 0;
  return Number((Math.round(value / step) * step).toFixed(decimals));
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const getIndicatorBaseId = (id: string): string => id.split("-")[0];

export const getIndicatorConfigById = (id: string): IndicatorConfig | undefined => {
  return INDICATOR_MAP.get(getIndicatorBaseId(id));
};

export const normalizeIndicatorParams = (
  config: IndicatorConfig,
  input?: Record<string, number>
): Record<string, number> => {
  if (config.params.length === 0) {
    return { ...config.defaultParams };
  }

  const normalized: Record<string, number> = { ...config.defaultParams };
  for (const paramDef of config.params) {
    const fallback = config.defaultParams[paramDef.key] ?? paramDef.min;
    const rawValue = input?.[paramDef.key];
    const sourceValue =
      typeof rawValue === "number" && Number.isFinite(rawValue) ? rawValue : fallback;
    const clamped = clamp(sourceValue, paramDef.min, paramDef.max);
    const quantized =
      paramDef.control === "int" ? Math.round(clamped) : quantize(clamped, paramDef.step);
    normalized[paramDef.key] = quantized;
  }
  return normalized;
};

export const createIndicatorInstanceId = (
  config: IndicatorConfig,
  params: Record<string, number>
): string => {
  if (!config.allowMultiple) {
    return config.id;
  }

  if (typeof params.period === "number") {
    return `${config.id}-${params.period}`;
  }

  const signature = Object.keys(params)
    .sort()
    .map((key) => `${key}${String(params[key]).replaceAll(".", "_")}`)
    .join("-");

  return signature.length > 0 ? `${config.id}-${signature}` : config.id;
};
