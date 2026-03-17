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
    <div className="flex sm:hidden items-center justify-between px-3 py-2 border-b border-border/50 bg-card">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold">{symbol}</h3>
        <div className="flex items-center">
          {DEFAULT_INTERVALS.map((int) => (
            <button
              key={int.value}
              onClick={() => onIntervalChange(int.value)}
              className={cn(
                "relative px-1.5 py-0.5 text-[10px] font-medium rounded transition-all duration-200 ease-premium tap-highlight",
                interval === int.value
                  ? "bg-primary text-primary-foreground scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {int.label}
              {isFetching && interval === int.value && (
                <span className="absolute -right-0.5 -top-0.5 flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-foreground" />
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onToggleFullscreen} className="h-7 w-7 p-0">
        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </Button>
    </div>
  );
});
