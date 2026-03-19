import { AVAILABLE_INDICATORS, getIndicatorBaseId } from "./config";
import { INDICATOR_OUTPUT } from "../patterns/constants";

export const BAND_INDICATOR_IDS = AVAILABLE_INDICATORS.filter(
  (indicator) => indicator.output === INDICATOR_OUTPUT.BAND
).map((indicator) => indicator.id);

export const HISTOGRAM_INDICATOR_IDS = AVAILABLE_INDICATORS.filter(
  (indicator) => indicator.output === INDICATOR_OUTPUT.HISTOGRAM
).map((indicator) => indicator.id);

export const isBandIndicator = (indicatorId: string): boolean => {
  const baseId = getIndicatorBaseId(indicatorId);
  return BAND_INDICATOR_IDS.includes(baseId);
};

export const isHistogramIndicator = (indicatorId: string): boolean => {
  const baseId = getIndicatorBaseId(indicatorId);
  return HISTOGRAM_INDICATOR_IDS.includes(baseId);
};
