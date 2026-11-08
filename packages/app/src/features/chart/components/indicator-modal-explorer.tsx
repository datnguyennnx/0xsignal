import { Search, X } from "lucide-react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { IndicatorCategory } from "./indicator-modal-category-list";
import { isIndicatorExplorerHidden } from "../lib/indicator-explorer";

interface IndicatorModalExplorerProps {
  category: IndicatorCategory;
  activeIndicatorCount: number;
  searchId: string;
  query: string;
  normalizedQuery: string;
  indicators: IndicatorConfig[];
  selectedIndicator: IndicatorConfig | null;
  activeByBaseId: Map<string, ActiveIndicator[]>;
  onQueryChange: (query: string) => void;
  onSelectIndicator: (indicatorId: string) => void;
}

export function IndicatorModalExplorer({
  category,
  activeIndicatorCount,
  searchId,
  query,
  normalizedQuery,
  indicators,
  selectedIndicator,
  activeByBaseId,
  onQueryChange,
  onSelectIndicator,
}: IndicatorModalExplorerProps) {
  const searchVisible = !isIndicatorExplorerHidden(category, activeIndicatorCount, normalizedQuery);

  // A searchless, listless column would read as a blank strip.
  if (!searchVisible && indicators.length === 0) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-col">
      {searchVisible && (
        <div className="p-panel">
          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-icon -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />

            <label htmlFor={searchId} className="sr-only">
              Search indicators
            </label>

            <Input
              id={searchId}
              value={query}
              onChange={(event) => {
                onQueryChange(event.target.value);
              }}
              placeholder="Find indicator..."
              className="rounded-control border-border bg-secondary pl-9 pr-8 text-secondary-foreground focus-ring"
            />

            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  onQueryChange("");
                }}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground transition-colors hover:bg-transparent hover:text-foreground dark:hover:bg-transparent"
              >
                <X className="size-icon" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}

      {indicators.length > 0 && (
        <div
          data-dense
          className="flex-1 overflow-y-auto px-3 py-2 min-h-0 scrollbar-none overscroll-none"
        >
          <div className="flex flex-col gap-1">
            {indicators.map((indicator) => {
              const activeCount = activeByBaseId.get(indicator.id)?.length ?? 0;
              const isSelected = selectedIndicator?.id === indicator.id;

              return (
                <button
                  key={indicator.id}
                  onClick={() => {
                    onSelectIndicator(indicator.id);
                  }}
                  className={cn(
                    "w-full flex items-center gap-(--control-gap) rounded-control px-3 py-2 type-control transition-[background-color,color,box-shadow] focus-ring",
                    isSelected
                      ? "bg-accent text-foreground font-semibold"
                      : "font-medium text-muted-foreground transition-[background-color,color] duration-(--duration-fast) hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full shrink-0 transition-[background-color,transform]",
                      activeCount > 0 ? "bg-foreground" : "bg-muted-foreground/25",
                      isSelected && "scale-105",
                    )}
                  />
                  <span className="flex-1 text-left truncate">{indicator.name}</span>
                  {activeCount > 0 ? (
                    <span className="type-data font-bold text-muted-foreground px-1">
                      {activeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
