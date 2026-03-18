/** @fileoverview Indicators hook - manages technical indicators state */
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

const generateRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 20);
  const lightness = 45 + Math.floor(Math.random() * 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

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
            color: generateRandomColor(),
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
