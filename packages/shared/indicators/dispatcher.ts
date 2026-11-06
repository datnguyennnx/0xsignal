import type { ChartDataPoint } from "../types/chart";
import type { IndicatorDataPoint, BandIndicatorDataPoint } from "./types";
import type { ActiveIndicator } from "./config";
import { getIndicatorBaseId } from "./config";
import { INDICATOR_OUTPUT, INDICATOR_REGISTRY_BY_ID } from "./constants";
import { isBandIndicator, isHistogramIndicator } from "./metadata";

export const calculateLineIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[],
): IndicatorDataPoint[] | null => {
  const definition = INDICATOR_REGISTRY_BY_ID.get(getIndicatorBaseId(indicator.config.id));
  if (definition === undefined || definition.output === INDICATOR_OUTPUT.BAND) {
    return null;
  }
  return definition.calculate(data, indicator.params);
};

export const calculateBandIndicator = (
  indicator: ActiveIndicator,
  data: ChartDataPoint[],
): BandIndicatorDataPoint[] | null => {
  const definition = INDICATOR_REGISTRY_BY_ID.get(getIndicatorBaseId(indicator.config.id));
  if (definition === undefined || definition.output !== INDICATOR_OUTPUT.BAND) {
    return null;
  }
  return definition.calculate(data, indicator.params);
};

export { isBandIndicator, isHistogramIndicator };
