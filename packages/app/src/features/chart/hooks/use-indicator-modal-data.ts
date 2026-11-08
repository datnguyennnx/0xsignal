import { useDeferredValue, useId } from "react";
import { AVAILABLE_INDICATORS, type ActiveIndicator, type IndicatorConfig } from "@0xsignal/shared";
import type { IndicatorCategory } from "../components/indicator-modal-category-list";

const overlayIndicators = AVAILABLE_INDICATORS.filter((indicator) => indicator.overlayOnPrice);
const oscillatorIndicators = AVAILABLE_INDICATORS.filter((indicator) => !indicator.overlayOnPrice);

interface UseIndicatorModalDataArgs {
  activeIndicators: ActiveIndicator[];
  category: IndicatorCategory;
  query: string;
  selectedId: string | null;
}

interface IndicatorModalData {
  searchId: string;
  normalizedQuery: string;
  indicators: IndicatorConfig[];
  selectedIndicator: IndicatorConfig | null;
  selectedActiveIndicators: ActiveIndicator[];
  activeIndicatorCount: number;
  activeByBaseId: Map<string, ActiveIndicator[]>;
  categoryCounts: Record<IndicatorCategory, number>;
}

const buildActiveByBaseId = (
  activeIndicators: ActiveIndicator[],
): Map<string, ActiveIndicator[]> => {
  const activeByBaseId = new Map<string, ActiveIndicator[]>();
  for (const indicator of activeIndicators) {
    const list = activeByBaseId.get(indicator.config.id) ?? [];
    list.push(indicator);
    activeByBaseId.set(indicator.config.id, list);
  }
  return activeByBaseId;
};

const matchesQuery = (indicator: IndicatorConfig, normalizedQuery: string): boolean =>
  indicator.name.toLowerCase().includes(normalizedQuery) ||
  indicator.id.toLowerCase().includes(normalizedQuery) ||
  indicator.description.toLowerCase().includes(normalizedQuery);

const selectIndicatorsForCategory = (
  category: IndicatorCategory,
  activeIndicatorConfigs: IndicatorConfig[],
): IndicatorConfig[] => {
  if (category === "active") return activeIndicatorConfigs;
  if (category === "overlays") return overlayIndicators;
  return oscillatorIndicators;
};

export const useIndicatorModalData = ({
  activeIndicators,
  category,
  query,
  selectedId,
}: UseIndicatorModalDataArgs): IndicatorModalData => {
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const activeByBaseId = buildActiveByBaseId(activeIndicators);
  const activeIndicatorConfigs = AVAILABLE_INDICATORS.filter((indicator) =>
    activeByBaseId.has(indicator.id),
  );

  const currentIndicators = selectIndicatorsForCategory(category, activeIndicatorConfigs);

  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const indicators = normalizedQuery
    ? currentIndicators.filter((indicator) => matchesQuery(indicator, normalizedQuery))
    : currentIndicators;

  const selectedIndicator =
    indicators.find((indicator) => indicator.id === selectedId) ?? indicators.at(0) ?? null;

  const selectedActiveIndicators =
    selectedIndicator === null ? [] : (activeByBaseId.get(selectedIndicator.id) ?? []);

  const categoryCounts: Record<IndicatorCategory, number> = {
    active: activeIndicators.length,
    overlays: overlayIndicators.length,
    oscillators: oscillatorIndicators.length,
  };

  return {
    searchId,
    normalizedQuery,
    indicators,
    selectedIndicator,
    selectedActiveIndicators,
    activeIndicatorCount: activeIndicatorConfigs.length,
    activeByBaseId,
    categoryCounts,
  };
};
