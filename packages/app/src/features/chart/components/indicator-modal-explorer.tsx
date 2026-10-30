import { Search, X } from "lucide-react";
import type { ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { IndicatorCategory } from "./indicator-modal-category-list";

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
  const searchVisible = !(category === "active" && activeIndicatorCount === 0 && !normalizedQuery);

  // A searchless, listless column would read as a blank strip.
  if (!searchVisible && indicators.length === 0) return null;

  return (
    <div className="w-full shrink-0 min-h-0 xl:w-[clamp(15rem,18vw,18rem)] flex flex-col">
      {searchVisible && (
        <div className="p-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none"
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
              className="pl-9 pr-8 bg-[color-mix(in_oklab,var(--ink)_8%,transparent)] border-border h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0 text-secondary"
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
                className="absolute right-2 top-[calc(50%-1rem)] text-muted-foreground/60 hover:bg-transparent hover:text-foreground dark:hover:bg-transparent transition-colors"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}

      {indicators.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0 scrollbar-none overscroll-none">
          <div className="space-y-0.5">
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
                    "w-full flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] px-3 py-3 sm:py-2 rounded text-xs transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    isSelected
                      ? "bg-accent text-foreground font-semibold"
                      : "hover:bg-accent/60 text-muted-foreground hover:text-foreground font-medium transition-[background-color,color] duration-150",
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
                    <span className="text-[length:var(--text-data)] font-bold text-muted-foreground/60 px-1">
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
