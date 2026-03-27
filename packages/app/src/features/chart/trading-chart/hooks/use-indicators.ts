/**
 * @overview Chart Indicators Hook
 *
 * Manages the client-side state of active technical indicators.
 * Provides functions for adding, removing, and toggling visibility of indicator instances.
 *
 * @mechanism
 * - utilizes useIndicatorData to calculate/retrieve time-series data for each active indicator.
 * - implements an instanceId system from @0xsignal/shared for tracking multiple indicators of the same type.
 */
import { useState, useCallback } from "react";
import type { ActiveIndicator, IndicatorConfig, ChartDataPoint } from "@0xsignal/shared";
import {
  createIndicatorInstanceId,
  getIndicatorBaseId,
  normalizeIndicatorParams,
} from "@0xsignal/shared";
import { useIndicatorData } from "./use-chart-data";
import type { IndicatorRenderEntry } from "./indicator-data.types";

interface UseIndicatorsProps {
  data?: ChartDataPoint[];
}

interface UseIndicatorsResult {
  activeIndicators: ActiveIndicator[];
  indicatorData: Map<string, IndicatorRenderEntry>;
  handleAddIndicator: (config: IndicatorConfig, customParams?: Record<string, number>) => void;
  handleRemoveIndicator: (indicatorId: string) => void;
  handleToggleIndicator: (indicatorId: string) => void;
  handleResetAll: () => void;
  hasActiveOverlays: boolean;
}

import { getStableColor } from "@/core/utils/theme";

export const useIndicators = ({ data = [] }: UseIndicatorsProps): UseIndicatorsResult => {
  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);

  const indicatorData = useIndicatorData(activeIndicators, data);

  const hasActiveOverlays = activeIndicators.length > 0;

  const handleAddIndicator = useCallback(
    (config: IndicatorConfig, customParams?: Record<string, number>) => {
      const params = normalizeIndicatorParams(config, customParams);
      const instanceId = createIndicatorInstanceId(config, params);

      setActiveIndicators((prev) => {
        const existingIdx = prev.findIndex((ind) => ind.instanceId === instanceId);
        if (existingIdx >= 0) {
          return prev.map((indicator, index) =>
            index === existingIdx
              ? {
                  ...indicator,
                  params,
                  visible: true,
                }
              : indicator
          );
        }

        return [
          ...prev,
          {
            instanceId,
            config,
            params,
            visible: true,
            color: getStableColor(instanceId),
          },
        ];
      });
    },
    []
  );

  const handleRemoveIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) => {
      const hasDirectMatch = prev.some((ind) => ind.instanceId === indicatorId);
      if (hasDirectMatch) {
        return prev.filter((ind) => ind.instanceId !== indicatorId);
      }

      return prev.filter((ind) => getIndicatorBaseId(ind.instanceId) !== indicatorId);
    });
  }, []);

  const handleToggleIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) => {
      const hasDirectMatch = prev.some((ind) => ind.instanceId === indicatorId);
      if (hasDirectMatch) {
        return prev.map((ind) =>
          ind.instanceId === indicatorId ? { ...ind, visible: !ind.visible } : ind
        );
      }

      return prev.map((ind) =>
        getIndicatorBaseId(ind.instanceId) === indicatorId ? { ...ind, visible: !ind.visible } : ind
      );
    });
  }, []);

  const handleResetAll = useCallback(() => {
    setActiveIndicators([]);
  }, []);

  return {
    activeIndicators,
    indicatorData,
    handleAddIndicator,
    handleRemoveIndicator,
    handleToggleIndicator,
    handleResetAll,
    hasActiveOverlays,
  };
};
