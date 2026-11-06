import { getIndicatorBaseId } from "./config";
import { INDICATOR_OUTPUT, INDICATOR_REGISTRY } from "./constants";

const definitions = Object.values(INDICATOR_REGISTRY);

export const BAND_INDICATOR_IDS: string[] = definitions
  .filter((definition) => definition.catalog.output === INDICATOR_OUTPUT.BAND)
  .map((definition) => definition.id);

export const HISTOGRAM_INDICATOR_IDS: string[] = definitions
  .filter((definition) => definition.catalog.output === INDICATOR_OUTPUT.HISTOGRAM)
  .map((definition) => definition.id);

export const isBandIndicator = (indicatorId: string): boolean => {
  const baseId = getIndicatorBaseId(indicatorId);
  return BAND_INDICATOR_IDS.includes(baseId);
};

export const isHistogramIndicator = (indicatorId: string): boolean => {
  const baseId = getIndicatorBaseId(indicatorId);
  return HISTOGRAM_INDICATOR_IDS.includes(baseId);
};
