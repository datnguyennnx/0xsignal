import { useState, useCallback, useMemo } from "react";
import { AVAILABLE_INDICATORS, type ActiveIndicator, type IndicatorConfig } from "@0xsignal/shared";
import { Layers, Activity, Search, Sparkles, X } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ContentUnavailable } from "@/components/content-unavailable";
import { IndicatorConfigPanel } from "./config-panel";
import { IndicatorInsightsPanel } from "./insights-panel";

interface IndicatorModalProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Category = "active" | "overlays" | "oscillators";

const categories: { id: Category; label: string; icon: typeof Sparkles }[] = [
  { id: "active", label: "Active", icon: Sparkles },
  { id: "overlays", label: "Overlays", icon: Layers },
  { id: "oscillators", label: "Oscillators", icon: Activity },
];

const overlayIndicators = AVAILABLE_INDICATORS.filter((i) => i.overlayOnPrice);
const oscillatorIndicators = AVAILABLE_INDICATORS.filter((i) => !i.overlayOnPrice);

export function IndicatorModal({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  open,
  onOpenChange,
}: IndicatorModalProps) {
  const [category, setCategory] = useState<Category>("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const activeByBaseId = useMemo(() => {
    const map = new Map<string, ActiveIndicator[]>();
    for (const indicator of activeIndicators) {
      const list = map.get(indicator.config.id) || [];
      list.push(indicator);
      map.set(indicator.config.id, list);
    }
    return map;
  }, [activeIndicators]);

  const activeIndicatorConfigs = useMemo(
    () => AVAILABLE_INDICATORS.filter((indicator) => activeByBaseId.has(indicator.id)),
    [activeByBaseId],
  );

  const currentIndicators =
    category === "active"
      ? activeIndicatorConfigs
      : category === "overlays"
        ? overlayIndicators
        : oscillatorIndicators;

  const normalizedQuery = query.trim().toLowerCase();
  const filteredIndicators = useMemo(() => {
    if (!normalizedQuery) return currentIndicators;
    return currentIndicators.filter((indicator) => {
      return (
        indicator.name.toLowerCase().includes(normalizedQuery) ||
        indicator.id.toLowerCase().includes(normalizedQuery) ||
        indicator.description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [currentIndicators, normalizedQuery]);

  const selectedIndicator =
    filteredIndicators.find((indicator) => indicator.id === selectedId) ||
    filteredIndicators[0] ||
    null;

  const selectedActiveIndicators = selectedIndicator
    ? activeByBaseId.get(selectedIndicator.id) || []
    : [];

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setSelectedId(null);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[98vw] xl:max-w-[clamp(90rem,100vw,100rem)] w-fit h-[clamp(18rem,80dvh,60rem)] p-0 gap-0 overflow-hidden bg-background border-border/40 shadow-xl rounded-lg animate-in fade-in duration-200 ease-premium"
      >
        <DialogTitle className="sr-only">Indicator Settings</DialogTitle>

        <div className="flex flex-col sm:flex-row h-full min-h-0 bg-background">
          {/* Column 1: Indicators Sidebar */}
          <div className="flex-[2] min-w-[clamp(10rem,15vw,14rem)] flex flex-col min-h-0 sm:max-h-[clamp(18rem,80dvh,60rem)]">
            <div className="p-4 sm:p-6 flex items-center justify-between sm:justify-start gap-[clamp(0.25rem,0.5vw,0.5rem)]">
              <h2 className="text-xs font-semibold text-muted-foreground">Indicators</h2>
              <button
                onClick={handleClose}
                className="sm:hidden p-2 min-w-[44px] min-h-[44px] flex items-center justify-center tap-highlight rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 min-h-0 scrollbar-none overscroll-none">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const count =
                  cat.id === "active"
                    ? activeIndicators.length
                    : cat.id === "overlays"
                      ? overlayIndicators.length
                      : oscillatorIndicators.length;

                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setCategory(cat.id);
                      setQuery("");
                      setSelectedId(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-[clamp(0.3rem,0.6vw,0.625rem)] px-3 py-3 sm:py-2 rounded text-xs transition-all duration-150 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                      category === cat.id
                        ? "bg-accent text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50 font-medium",
                    )}
                  >
                    <Icon
                      className={cn("w-3.5 h-3.5 shrink-0", category === cat.id && "text-primary")}
                    />
                    <span className="flex-1 text-left truncate">{cat.label}</span>
                    <span
                      className={cn(
                        "text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] px-1 rounded tabular-nums font-bold",
                        category === cat.id
                          ? "bg-background/20 opacity-60"
                          : "bg-muted text-muted-foreground/60",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Column 2: Indicator Explorer */}
          <div className="flex-[2] min-w-[clamp(12rem,18vw,16rem)] max-h-[clamp(14rem,60dvh,32rem)] sm:max-h-[clamp(18rem,80dvh,60rem)] flex flex-col min-h-0">
            {!(category === "active" && activeIndicatorConfigs.length === 0) && (
              <div className="p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />

                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Find indicator..."
                    className="pl-9 pr-8 bg-muted/30 border-border h-10 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-offset-0 text-secondary"
                  />

                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center text-muted-foreground/60 hover:text-foreground transition-colors"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 py-2 min-h-0 scrollbar-none overscroll-none">
              {filteredIndicators.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredIndicators.map((indicator) => {
                    const activeCount = activeByBaseId.get(indicator.id)?.length || 0;
                    const isSelected = selectedIndicator?.id === indicator.id;

                    return (
                      <button
                        key={indicator.id}
                        onClick={() => setSelectedId(indicator.id)}
                        className={cn(
                          "w-full flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)] px-3 py-3 sm:py-2 rounded text-xs transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                          isSelected
                            ? "bg-accent text-foreground font-semibold"
                            : "hover:bg-accent/50 text-muted-foreground hover:text-foreground font-medium transition-all duration-150",
                        )}
                      >
                        <div
                          className={cn(
                            "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                            activeCount > 0 ? "bg-foreground" : "bg-muted-foreground/20",
                            isSelected && "scale-105",
                          )}
                        />
                        <span className="flex-1 text-left truncate">{indicator.name}</span>
                        {activeCount > 0 ? (
                          <span className="text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] font-bold text-muted-foreground/40 px-1">
                            {activeCount}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="min-h-full flex items-center justify-center">
                  <ContentUnavailable
                    variant="no-results"
                    title="No Indicators"
                    description={
                      normalizedQuery
                        ? `No indicators match "${normalizedQuery}".`
                        : "No indicators in this category."
                    }
                  />
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Insight Content */}
          <div className="flex-[4] min-w-[clamp(18rem,30vw,28rem)] min-h-0 flex flex-col bg-background/30 max-h-[clamp(14rem,60dvh,32rem)] sm:max-h-none">
            {selectedIndicator ? (
              <IndicatorInsightsPanel
                key={`${selectedIndicator.id}-insights`}
                indicator={selectedIndicator}
                className="scrollbar-none px-2 flex-1"
              />
            ) : (
              <ContentUnavailable
                variant="no-data"
                title="No Indicator Selected"
                description="Select an indicator from the list to view its details."
              />
            )}
          </div>

          {/* Column 4: Inspector Sidepan */}
          <div className="flex-[1] min-w-[clamp(14rem,16vw,18rem)] max-h-[clamp(14rem,60dvh,32rem)] sm:max-h-[clamp(18rem,80dvh,60rem)] flex flex-col min-h-0 shadow-[-1px_0_0_0_rgba(0,0,0,0.02)]">
            {selectedIndicator ? (
              <IndicatorConfigPanel
                key={`${selectedIndicator.id}-config`}
                indicator={selectedIndicator}
                activeIndicators={selectedActiveIndicators}
                onApply={(params) => onAddIndicator(selectedIndicator, params)}
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
