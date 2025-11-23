import { useState } from "react";
import {
  AVAILABLE_INDICATORS,
  type ActiveIndicator,
  type IndicatorConfig,
} from "@/domain/chart/indicators/config";
import { cn } from "@/core/utils/cn";
import {
  X,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Zap,
  Activity,
  Package,
  Waves,
  Eye,
  EyeOff,
} from "lucide-react";
import { IndicatorParamsDialog } from "./indicator-params-dialog";

interface ChartSidebarProps {
  activeIndicators: ActiveIndicator[];
  onAddIndicator: (indicator: IndicatorConfig, customParams?: Record<string, number>) => void;
  onRemoveIndicator: (indicatorId: string) => void;
  onToggleIndicator: (indicatorId: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export function ChartSidebar({
  activeIndicators,
  onAddIndicator,
  onRemoveIndicator,
  onToggleIndicator,
  onToggle,
}: ChartSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(["trend", "momentum"])
  );
  const [selectedIndicator, setSelectedIndicator] = useState<IndicatorConfig | null>(null);

  const categories = [
    { id: "trend", label: "Trend", Icon: TrendingUp, color: "text-blue-500" },
    { id: "momentum", label: "Momentum", Icon: Zap, color: "text-orange-500" },
    { id: "volatility", label: "Volatility", Icon: Activity, color: "text-purple-500" },
    { id: "volume", label: "Volume", Icon: Package, color: "text-amber-500" },
    { id: "oscillators", label: "Oscillators", Icon: Waves, color: "text-green-500" },
  ];

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const isIndicatorActive = (id: string) => activeIndicators.some((ind) => ind.config.id === id);

  const getIndicatorsByCategory = (categoryId: string) =>
    AVAILABLE_INDICATORS.filter((ind) => ind.category === categoryId);

  const handleIndicatorClick = (indicator: IndicatorConfig) => {
    if (isIndicatorActive(indicator.id)) return;
    setSelectedIndicator(indicator);
  };

  const handleConfirmParams = (params: Record<string, number>) => {
    if (selectedIndicator) {
      onAddIndicator(selectedIndicator, params);
      setSelectedIndicator(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Indicators</h3>
          {activeIndicators.length > 0 && (
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary/10 text-primary">
              {activeIndicators.length}
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-muted rounded transition-colors"
          aria-label="Close sidebar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Active Indicators */}
      {activeIndicators.length > 0 && (
        <div className="p-4 border-b border-border shrink-0">
          <div className="text-xs font-medium text-muted-foreground mb-3">Active</div>
          <div className="space-y-2">
            {activeIndicators.map((ind) => (
              <div
                key={ind.config.id}
                className="flex items-center gap-2 p-3 rounded bg-muted/30 group"
              >
                {/* Color Indicator */}
                <div
                  className="w-3 h-3 rounded-full shrink-0 ring-2 ring-background"
                  style={{ backgroundColor: ind.color }}
                />

                {/* Name */}
                <span className="text-xs font-medium flex-1 min-w-0 truncate">
                  {ind.config.name}
                </span>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onToggleIndicator(ind.config.id)}
                    className="p-1 hover:bg-muted rounded transition-colors"
                    aria-label={ind.visible ? "Hide" : "Show"}
                  >
                    {ind.visible ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 opacity-50" />
                    )}
                  </button>
                  <button
                    onClick={() => onRemoveIndicator(ind.config.id)}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive rounded transition-all"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Available Indicators */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <div className="text-xs font-medium text-muted-foreground mb-3">Add Indicator</div>
          <div className="space-y-2">
            {categories.map((category) => {
              const indicators = getIndicatorsByCategory(category.id);
              const isExpanded = expandedCategories.has(category.id);
              const Icon = category.Icon;

              return (
                <div key={category.id}>
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full flex items-center justify-between p-2 rounded hover:bg-muted transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", category.color)} />
                      <span className="text-xs font-medium">{category.label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        ({indicators.length})
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                  </button>

                  {/* Category Indicators */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {indicators.map((indicator) => {
                        const isActive = isIndicatorActive(indicator.id);
                        return (
                          <button
                            key={indicator.id}
                            onClick={() => handleIndicatorClick(indicator)}
                            disabled={isActive}
                            className={cn(
                              "w-full text-left p-2 rounded transition-colors",
                              isActive
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:bg-muted hover:border-l-2 hover:border-primary"
                            )}
                          >
                            <div className="text-xs font-medium">{indicator.name}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                              {indicator.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Parameter Dialog */}
      {selectedIndicator && (
        <IndicatorParamsDialog
          indicator={selectedIndicator}
          onConfirm={handleConfirmParams}
          onCancel={() => setSelectedIndicator(null)}
        />
      )}
    </div>
  );
}
