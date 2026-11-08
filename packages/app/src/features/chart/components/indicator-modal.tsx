import { useState, useCallback } from "react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIndicatorModalData } from "../hooks/use-indicator-modal-data";
import { isIndicatorExplorerHidden } from "../lib/indicator-explorer";
import {
  IndicatorModalCategoryList,
  type IndicatorCategory,
} from "./indicator-modal-category-list";
import { IndicatorModalDetail } from "./indicator-modal-detail";
import { IndicatorModalEmptyState } from "./indicator-modal-empty-state";
import { IndicatorModalExplorer } from "./indicator-modal-explorer";

interface IndicatorModalProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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

  const data = useIndicatorModalData({ activeIndicators, category, query, selectedId });

  const explorerHidden = isIndicatorExplorerHidden(
    category,
    data.activeIndicatorCount,
    data.normalizedQuery,
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      onOpenChange(next);
      if (!next) setSelectedId(null);
    },
    [onOpenChange],
  );

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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        layout="workspace"
        showCloseButton={false}
        className="grid-rows-[minmax(0,1fr)] gap-0 p-0"
      >
        <DialogTitle className="sr-only">Indicator Settings</DialogTitle>

        <div className="@container flex h-full min-h-0 flex-col">
          <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-border overflow-y-auto @min-[72rem]:grid-cols-[minmax(11rem,16rem)_minmax(15rem,18rem)_minmax(0,1fr)_minmax(15rem,19rem)] @min-[72rem]:divide-x @min-[72rem]:divide-y-0 @min-[72rem]:overflow-hidden">
            <IndicatorModalCategoryList
              category={category}
              counts={data.categoryCounts}
              onSelectCategory={handleSelectCategory}
            />

            <IndicatorModalExplorer
              category={category}
              activeIndicatorCount={data.activeIndicatorCount}
              searchId={data.searchId}
              query={query}
              normalizedQuery={data.normalizedQuery}
              indicators={data.indicators}
              selectedIndicator={data.selectedIndicator}
              activeByBaseId={data.activeByBaseId}
              onQueryChange={handleQueryChange}
              onSelectIndicator={handleSelectIndicator}
            />

            {data.selectedIndicator && (
              <IndicatorModalDetail
                indicator={data.selectedIndicator}
                activeIndicators={data.selectedActiveIndicators}
                onAddIndicator={onAddIndicator}
                onRemoveIndicator={onRemoveIndicator}
              />
            )}

            {data.selectedIndicator === null && (
              <IndicatorModalEmptyState
                normalizedQuery={data.normalizedQuery}
                explorerHidden={explorerHidden}
                onClearSearch={() => {
                  handleQueryChange("");
                }}
                onBrowseOverlays={() => {
                  handleSelectCategory("overlays");
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
