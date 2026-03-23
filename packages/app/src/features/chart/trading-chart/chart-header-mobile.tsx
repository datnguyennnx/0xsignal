/**
 * @overview Mobile Chart Control Bar
 *
 * Optimized header for small screens.
 * Contains the symbol ticker, timeframe (interval) selection, view mode toggle (chart vs depth), and fullscreen controls.
 */
import { memo } from "react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { DEFAULT_INTERVALS } from "./constants";
import type { ChartViewMode } from "./types";

interface ChartHeaderMobileProps {
  symbol: string;
  interval: string;
  isFullscreen: boolean;
  onIntervalChange: (interval: string) => void;
  onToggleFullscreen: () => void;
  isFetching?: boolean;
  viewMode?: ChartViewMode;
  onViewModeChange?: (mode: ChartViewMode) => void;
}

export const ChartHeaderMobile = memo(function ChartHeaderMobile({
  symbol,
  interval,
  isFullscreen,
  onIntervalChange,
  onToggleFullscreen,
  isFetching = false,
  viewMode = "chart",
  onViewModeChange,
}: ChartHeaderMobileProps) {
  const isDepthMode = viewMode === "depth";

  return (
    <div className="flex sm:hidden items-center justify-between px-3 py-2 border-b border-border/50 bg-card">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold">{symbol}</h3>
        <div className="flex items-center">
          {DEFAULT_INTERVALS.map((int) => (
            <Button
              key={int.value}
              variant={interval === int.value ? "default" : "ghost"}
              size="sm"
              onClick={() => onIntervalChange(int.value)}
              className={cn(
                "relative px-1.5 py-0.5 text-[10px] font-medium rounded transition-all duration-200 ease-premium active:scale-[0.97]",
                interval === int.value ? "scale-[1.02]" : ""
              )}
            >
              {int.label}
              {isFetching && interval === int.value && (
                <span className="absolute -right-0.5 -top-0.5 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* View Mode Toggle - Mobile */}
        {onViewModeChange && (
          <div className="flex items-center gap-1 ml-1 px-1 py-0.5 rounded bg-muted/50">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium",
                !isDepthMode && "bg-background"
              )}
              onClick={() => onViewModeChange("chart")}
            >
              Chart
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium",
                isDepthMode && "bg-background"
              )}
              onClick={() => onViewModeChange("depth")}
            >
              Depth
            </Button>
          </div>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={onToggleFullscreen} className="h-7 w-7 p-0">
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </Button>
    </div>
  );
});
