import { memo } from "react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { INTERVALS } from "./constants";

interface ChartHeaderMobileProps {
  symbol: string;
  interval: string;
  isFullscreen: boolean;
  onIntervalChange: (interval: string) => void;
  onToggleFullscreen: () => void;
}

export const ChartHeaderMobile = memo(function ChartHeaderMobile({
  symbol,
  interval,
  isFullscreen,
  onIntervalChange,
  onToggleFullscreen,
}: ChartHeaderMobileProps) {
  return (
    <div className="flex sm:hidden items-center justify-between px-3 py-2 border-b border-border/50 bg-card">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold">{symbol}</h3>
        <div className="flex items-center">
          {INTERVALS.map((int) => (
            <button
              key={int.value}
              onClick={() => onIntervalChange(int.value)}
              className={cn(
                "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                interval === int.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}
            >
              {int.label}
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
