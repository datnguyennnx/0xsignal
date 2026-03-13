import { useMemo } from "react";
import type { ChartDataPoint, ActiveIndicator } from "@0xsignal/shared";
import { calculateLineIndicator, calculateBandIndicator, isBandIndicator } from "@0xsignal/shared";

export const useIndicatorData = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]) => {
  return useMemo(() => {
    if (data.length === 0) return new Map();
    const results = new Map<string, { type: "line" | "band"; data: unknown }>();

    for (const indicator of activeIndicators) {
      if (!indicator.visible) continue;
      if (isBandIndicator(indicator.config.id)) {
        const bandData = calculateBandIndicator(indicator, data);
        if (bandData?.length) results.set(indicator.config.id, { type: "band", data: bandData });
      } else {
        const lineData = calculateLineIndicator(indicator, data);
        if (lineData?.length) results.set(indicator.config.id, { type: "line", data: lineData });
      }
    }
    return results;
  }, [activeIndicators, data]);
};
