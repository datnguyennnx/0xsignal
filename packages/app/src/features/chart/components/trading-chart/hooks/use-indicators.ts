/** @fileoverview Indicators hook - manages technical indicators state */
import { useState, useCallback, useMemo } from "react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { MULTI_INSTANCE_INDICATORS } from "@0xsignal/shared";
import { useIndicatorData } from "./use-chart-data";

interface UseIndicatorsProps {
  priceFormat: { formatter?: (price: number) => string };
}

interface UseIndicatorsResult {
  activeIndicators: ActiveIndicator[];
  indicatorData: Map<string, { type: "line" | "band"; data: unknown }>;
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

export const useIndicators = ({ priceFormat }: UseIndicatorsProps): UseIndicatorsResult => {
  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);

  const indicatorData = useIndicatorData(activeIndicators, []);

  const hasActiveOverlays = useMemo(() => activeIndicators.length > 0, [activeIndicators.length]);

  const handleAddIndicator = useCallback(
    (config: IndicatorConfig, customParams?: Record<string, number>) => {
      const params = customParams || config.defaultParams || {};
      const uniqueId = MULTI_INSTANCE_INDICATORS.includes(
        config.id as (typeof MULTI_INSTANCE_INDICATORS)[number]
      )
        ? `${config.id}-${params.period || 20}`
        : config.id;

      setActiveIndicators((prev) => {
        if (prev.some((ind) => ind.config.id === uniqueId)) return prev;
        return [
          ...prev,
          {
            config: {
              ...config,
              id: uniqueId,
              name: params.period ? `${config.name} (${params.period})` : config.name,
            },
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
    setActiveIndicators((prev) => prev.filter((ind) => ind.config.id !== indicatorId));
  }, []);

  const handleToggleIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.map((ind) => (ind.config.id === indicatorId ? { ...ind, visible: !ind.visible } : ind))
    );
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
