import { useState, useCallback, useId, useDeferredValue } from "react";
import { AVAILABLE_INDICATORS, type ActiveIndicator, type IndicatorConfig } from "@0xsignal/shared";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Modal, type ModalDismissReason } from "@/components/ui/modal";
import { IndicatorConfigPanel } from "./config-panel";
import { IndicatorInsightsPanel } from "./insights-panel";
import {
  IndicatorModalCategoryList,
  type IndicatorCategory,
} from "./indicator-modal-category-list";
import { IndicatorModalExplorer } from "./indicator-modal-explorer";

/** `DialogContent`'s box defaults, restated at the panel's own width so no `sm:` cap survives. */
const PANEL_CONTENT_CLASS =
  "max-w-[98vw] sm:max-w-[98vw] gap-0 overflow-hidden rounded-[var(--radius-overlay,0.875rem)] bg-transparent p-0 text-sm text-popover-foreground";

interface IndicatorModalProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean, reason?: ModalDismissReason) => void;
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
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();
  const titleId = useId();

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

  const normalizedQuery = deferredQuery.trim().toLowerCase();
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

  const handleOpenChange = useCallback(
    (next: boolean, reason?: ModalDismissReason) => {
      onOpenChange(next, reason);
      if (!next) setSelectedId(null);
    },
    [onOpenChange],
  );

  const handleRequestClose = useCallback(() => {
    handleOpenChange(false, "close-press");
  }, [handleOpenChange]);

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
    <Modal
      open={open}
      aria-labelledby={titleId}
      onOpenChange={(next, details) => {
        handleOpenChange(next, details.reason);
      }}
      className={cn(
        PANEL_CONTENT_CLASS,
        "xl:max-w-[clamp(90rem,100vw,100rem)] h-[clamp(18rem,80dvh,60rem)] animate-in fade-in duration-200 ease-premium",
      )}
    >
      <h2 id={titleId} className="sr-only">
        Indicator Settings
      </h2>

      <div className="flex flex-col xl:flex-row h-full min-h-0 max-xl:overflow-y-auto max-xl:[&>*:first-child]:w-full max-xl:[&>*:first-child]:max-w-none divide-y xl:divide-y-0 xl:divide-x divide-border">
        <IndicatorModalCategoryList
          category={category}
          counts={categoryCounts}
          onSelectCategory={handleSelectCategory}
          onClose={handleRequestClose}
        />

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

        {selectedIndicator && (
          <>
            <div className="flex-none min-w-0 flex flex-col xl:min-h-0 xl:flex-1">
              <IndicatorInsightsPanel
                key={`${selectedIndicator.id}-insights`}
                indicator={selectedIndicator}
                className="scrollbar-none px-2 flex-1"
              />
            </div>

            <div className="w-full shrink-0 min-h-0 xl:w-fit xl:min-w-[15rem] xl:max-w-[19rem] flex flex-col">
              <IndicatorConfigPanel
                key={`${selectedIndicator.id}-config`}
                indicator={selectedIndicator}
                activeIndicators={selectedActiveIndicators}
                onApply={(params) => {
                  onAddIndicator(selectedIndicator, params);
                }}
                onRemoveInstance={onRemoveIndicator}
              />
            </div>
          </>
        )}

        {selectedIndicator === null && (
          <div className="flex-none min-w-0 flex flex-col xl:min-h-0 xl:flex-1">
            <EmptyState
              variant="panel"
              fill
              className="mx-auto w-full max-w-md"
              title={normalizedQuery ? "No indicators match" : "No indicators active yet"}
              description={
                normalizedQuery
                  ? `Nothing matches "${normalizedQuery}".`
                  : "Add an overlay or oscillator to track it on the chart."
              }
              action={
                normalizedQuery ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleQueryChange("");
                    }}
                  >
                    Clear search
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      handleSelectCategory("overlays");
                    }}
                  >
                    Browse Overlays
                  </Button>
                )
              }
            />
          </div>
        )}
      </div>
    </Modal>
  );
}
