import { useState, useCallback, useId } from "react";
import { AVAILABLE_INDICATORS, type ActiveIndicator, type IndicatorConfig } from "@0xsignal/shared";
import { cn } from "cn";
import { Dialog, DialogContent, DialogTitle, MODAL_CONTENT_CLASS } from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { IndicatorConfigPanel } from "./config-panel";
import { IndicatorInsightsPanel } from "./insights-panel";
import {
  IndicatorModalCategoryList,
  type IndicatorCategory,
} from "./indicator-modal-category-list";
import { IndicatorModalExplorer } from "./indicator-modal-explorer";

interface IndicatorModalProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const overlayIndicators = AVAILABLE_INDICATORS.filter((i) => i.overlayOnPrice);
const oscillatorIndicators = AVAILABLE_INDICATORS.filter((i) => !i.overlayOnPrice);

export function IndicatorModal({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  open,
  onOpenChange,
}: IndicatorModalProps) {
  const [category, setCategory] = useState<IndicatorCategory>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const searchId = useId();

  const activeByBaseId = new Map<string, ActiveIndicator[]>();
  for (const indicator of activeIndicators) {
    const list = activeByBaseId.get(indicator.config.id) ?? [];
    list.push(indicator);
    activeByBaseId.set(indicator.config.id, list);
  }

  const activeIndicatorConfigs = AVAILABLE_INDICATORS.filter((indicator) =>
    activeByBaseId.has(indicator.id),
  );

  const currentIndicators =
    category === "active"
      ? activeIndicatorConfigs
      : category === "overlays"
        ? overlayIndicators
        : oscillatorIndicators;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredIndicators = normalizedQuery
    ? currentIndicators.filter((indicator) => {
        return (
          indicator.name.toLowerCase().includes(normalizedQuery) ||
          indicator.id.toLowerCase().includes(normalizedQuery) ||
          indicator.description.toLowerCase().includes(normalizedQuery)
        );
      })
    : currentIndicators;

  const selectedIndicator =
    filteredIndicators.find((indicator) => indicator.id === selectedId) ??
    filteredIndicators.at(0) ??
    null;

  const selectedActiveIndicators =
    selectedIndicator === null ? [] : (activeByBaseId.get(selectedIndicator.id) ?? []);

  const categoryCounts: Record<IndicatorCategory, number> = {
    active: activeIndicators.length,
    overlays: overlayIndicators.length,
    oscillators: oscillatorIndicators.length,
  };

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSelectedId(null);
  }, [onOpenChange]);

  const handleSelectCategory = (next: IndicatorCategory) => {
    setCategory(next);
    setQuery("");
    setSelectedId(null);
  };

  const handleQueryChange = (next: string) => {
    setQuery(next);
  };

  const handleSelectIndicator = (indicatorId: string) => {
    setSelectedId(indicatorId);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          MODAL_CONTENT_CLASS,
          "max-w-[98vw] xl:max-w-[clamp(90rem,100vw,100rem)] w-fit h-[clamp(18rem,80dvh,60rem)] p-0 gap-0 rounded-[var(--radius-overlay,0.875rem)] animate-in fade-in duration-200 ease-premium",
        )}
      >
        <DialogTitle className="sr-only">Indicator Settings</DialogTitle>

        <div className="flex flex-col sm:flex-row h-full min-h-0 divide-y sm:divide-y-0 sm:divide-x divide-[var(--tier-edge)]">
          {/* Column 1: Indicators Sidebar */}
          <IndicatorModalCategoryList
            category={category}
            counts={categoryCounts}
            onSelectCategory={handleSelectCategory}
            onClose={handleClose}
          />

          {/* Column 2: Indicator Explorer */}
          <IndicatorModalExplorer
            category={category}
            activeIndicatorCount={activeIndicatorConfigs.length}
            searchId={searchId}
            query={query}
            normalizedQuery={normalizedQuery}
            indicators={filteredIndicators}
            selectedIndicator={selectedIndicator}
            activeByBaseId={activeByBaseId}
            onQueryChange={handleQueryChange}
            onSelectIndicator={handleSelectIndicator}
          />

          {/* Column 3: Insight Content */}
          <div className="flex-[4] min-w-[clamp(18rem,30vw,28rem)] min-h-0 flex flex-col max-h-[clamp(14rem,60dvh,32rem)] sm:max-h-none">
            {selectedIndicator ? (
              <IndicatorInsightsPanel
                key={`${selectedIndicator.id}-insights`}
                indicator={selectedIndicator}
                className="scrollbar-none px-2 flex-1"
              />
            ) : (
              <EmptyState
                variant="panel"
                title="No Indicator Selected"
                description="Select an indicator from the list to view its details."
              />
            )}
          </div>

          {/* Column 4: Inspector Sidepan */}
          <div className="flex-[1] min-w-[clamp(14rem,16vw,18rem)] max-h-[clamp(14rem,60dvh,32rem)] sm:max-h-[clamp(18rem,80dvh,60rem)] flex flex-col min-h-0">
            {selectedIndicator ? (
              <IndicatorConfigPanel
                key={`${selectedIndicator.id}-config`}
                indicator={selectedIndicator}
                activeIndicators={selectedActiveIndicators}
                onApply={(params) => {
                  onAddIndicator(selectedIndicator, params);
                }}
                onRemoveInstance={onRemoveIndicator}
              />
            ) : (
              <div className="h-full" />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
