import { AVAILABLE_INDICATORS, getIndicatorBaseId } from "./config";

export const BAND_INDICATOR_IDS = AVAILABLE_INDICATORS.filter(
  (indicator) => indicator.output === "band"
).map((indicator) => indicator.id);

export const HISTOGRAM_INDICATOR_IDS = AVAILABLE_INDICATORS.filter(
  (indicator) => indicator.output === "histogram"
).map((indicator) => indicator.id);

export const isBandIndicator = (indicatorId: string): boolean => {
  const baseId = getIndicatorBaseId(indicatorId);
  return BAND_INDICATOR_IDS.includes(baseId);
};

export const isHistogramIndicator = (indicatorId: string): boolean => {
  const baseId = getIndicatorBaseId(indicatorId);
  return HISTOGRAM_INDICATOR_IDS.includes(baseId);
};
