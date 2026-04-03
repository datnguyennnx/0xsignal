/**
 * @overview Mobile Chart Control Bar
 *
 * Optimized header for small screens.
 * Contains the symbol ticker, timeframe (interval) selection, and fullscreen controls.
 */
import { memo } from "react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { DEFAULT_INTERVALS } from "./constants";

interface ChartHeaderMobileProps {
  symbol: string;
  interval: string;
  isFullscreen: boolean;
  onIntervalChange: (interval: string) => void;
  onToggleFullscreen: () => void;
  isFetching?: boolean;
}

export const ChartHeaderMobile = memo(function ChartHeaderMobile({
  symbol,
  interval,
  isFullscreen,
  onIntervalChange,
  onToggleFullscreen,
  isFetching = false,
}: ChartHeaderMobileProps) {
  return (
    <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-card gap-2">
      <h3 className="text-xs font-semibold shrink-0">{symbol}</h3>
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
        {DEFAULT_INTERVALS.map((int) => (
          <Button
            key={int.value}
            variant={interval === int.value ? "default" : "ghost"}
            onClick={() => onIntervalChange(int.value)}
            className={cn(
              "relative min-h-[44px] min-w-[44px] px-3 text-[11px] font-medium rounded-lg shrink-0 transition-colors active:opacity-70",
              interval === int.value ? "" : ""
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
      <Button
        variant="ghost"
        onClick={onToggleFullscreen}
        className="min-h-[44px] min-w-[44px] p-2 shrink-0"
      >
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </Button>
    </div>
  );
});
