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
    <div className="flex sm:hidden items-center justify-between px-[clamp(0.5rem,2.8vw,0.75rem)] py-[clamp(0.375rem,1.8vw,0.625rem)] bg-card gap-[clamp(0.25rem,1.2vw,0.5rem)]">
      <h3 className="text-[clamp(0.68rem,2.6vw,0.75rem)] font-semibold shrink-0">{symbol}</h3>
      <div className="flex-1 flex items-center overflow-x-auto scrollbar-hide">
        {DEFAULT_INTERVALS.map((int) => (
          <Button
            key={int.value}
            variant="ghost"
            onClick={() => onIntervalChange(int.value)}
            className={cn(
              "relative min-h-[clamp(2.25rem,8.4vw,2.75rem)] min-w-[clamp(2.25rem,8.4vw,2.75rem)] px-[clamp(0.5rem,2vw,0.75rem)] text-[clamp(0.66rem,2.2vw,0.75rem)] font-medium rounded-lg shrink-0 transition-colors active:opacity-70 border focus-visible:ring-2 focus-visible:ring-ring/25",
              interval === int.value
                ? "border-border/60 bg-muted/70 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
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
        className="min-h-[clamp(2.25rem,8.4vw,2.75rem)] min-w-[clamp(2.25rem,8.4vw,2.75rem)] p-[clamp(0.375rem,1.6vw,0.5rem)] shrink-0 border border-border/50 bg-background/70 hover:bg-muted/40 focus-visible:ring-ring/25"
      >
        {isFullscreen ? (
          <Minimize2 className="size-[clamp(0.85rem,3.2vw,1rem)]" />
        ) : (
          <Maximize2 className="size-[clamp(0.85rem,3.2vw,1rem)]" />
        )}
      </Button>
    </div>
  );
});
