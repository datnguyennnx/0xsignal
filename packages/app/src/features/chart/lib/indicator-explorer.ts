import type { IndicatorCategory } from "../components/indicator-modal-category-list";

export function isIndicatorExplorerHidden(
  category: IndicatorCategory,
  activeIndicatorCount: number,
  normalizedQuery: string,
): boolean {
  return category === "active" && activeIndicatorCount === 0 && !normalizedQuery;
}
