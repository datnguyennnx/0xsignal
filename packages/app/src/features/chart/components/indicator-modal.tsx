import { useState, useCallback, useMemo } from "react";
import { AVAILABLE_INDICATORS, type ActiveIndicator, type IndicatorConfig } from "@0xsignal/shared";
import { Layers, Activity, Sparkles } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ContentUnavailable } from "@/components/content-unavailable";
import { IndicatorConfigPanel } from "./indicator-modal/indicator-config-panel";
import { IndicatorInsightsPanel } from "./indicator-modal/indicator-insights-panel";

interface IndicatorModalProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, params?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Category = "active" | "overlays" | "oscillators";

const categories = [
  { id: "active" as Category, label: "Active", icon: Sparkles },
  { id: "overlays" as Category, label: "Overlays", icon: Layers },
  { id: "oscillators" as Category, label: "Oscillators", icon: Activity },
];

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

  const overlayIndicators = useMemo(() => AVAILABLE_INDICATORS.filter((i) => i.overlayOnPrice), []);
  const oscillatorIndicators = useMemo(
    () => AVAILABLE_INDICATORS.filter((i) => !i.overlayOnPrice),
    []
  );

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
    [activeByBaseId]
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
        className="max-w-[98vw] xl:max-w-[1600px] w-fit h-[90vh] p-0 gap-0 overflow-hidden bg-background border-border/30 shadow-xl rounded-lg"
      >
        <DialogTitle className="sr-only">Indicator Settings</DialogTitle>

        <div className="flex h-full divide-x divide-border/50 min-h-0 bg-background">
          {/* Column 1: Indicators Sidebar */}
          <div className="w-[180px] flex flex-col shrink-0 min-h-0">
            <div className="p-6">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                Indicators
              </h2>
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
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded text-[12px] transition-colors",
                      category === cat.id
                        ? "bg-foreground text-background font-bold shadow-sm"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground/80 font-medium"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="flex-1 text-left truncate">{cat.label}</span>
                    <span
                      className={cn(
                        "text-[10px] px-1 rounded tabular-nums font-bold",
                        category === cat.id
                          ? "bg-background/20 opacity-60"
                          : "bg-muted text-muted-foreground/60"
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
          <div className="w-[280px] flex flex-col shrink-0 min-h-0">
            <div className="p-4">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find indicator..."
                className="h-9 text-[11px] bg-muted/20 border-border/40 focus-visible:ring-offset-0 focus-visible:ring-muted-foreground/10 placeholder:opacity-30 rounded px-3"
              />
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 min-h-0 scrollbar-none overscroll-none">
              {filteredIndicators.length > 0 ? (
                filteredIndicators.map((indicator) => {
                  const activeCount = activeByBaseId.get(indicator.id)?.length || 0;
                  const isSelected = selectedIndicator?.id === indicator.id;

                  return (
                    <button
                      key={indicator.id}
                      onClick={() => setSelectedId(indicator.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded text-[12px] transition-all",
                        isSelected
                          ? "bg-muted text-foreground font-bold shadow-inner"
                          : "hover:bg-muted/30 text-muted-foreground/60 hover:text-foreground font-medium"
                      )}
                    >
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                          activeCount > 0 ? "bg-foreground" : "bg-muted-foreground/20",
                          isSelected && "scale-105"
                        )}
                      />
                      <span className="flex-1 text-left truncate">{indicator.name}</span>
                      {activeCount > 0 ? (
                        <span className="text-[10px] font-bold text-muted-foreground/40 px-1">
                          {activeCount}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <ContentUnavailable
                  variant="no-results"
                  title="No Indicators"
                  description={
                    normalizedQuery
                      ? `No indicators match "${normalizedQuery}".`
                      : "No indicators in this category."
                  }
                />
              )}
            </div>
          </div>

          {/* Column 3: Insight Content */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col bg-background/30">
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
          <div className="w-[350px] lg:w-[400px] flex flex-col shrink-0 min-h-0 shadow-[-1px_0_0_0_rgba(0,0,0,0.02)]">
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
