import { memo } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { cn } from "@/core/utils/cn";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { ActiveIndicator } from "@0xsignal/shared";

interface IndicatorLegendProps {
  indicators: ActiveIndicator[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  className?: string;
}

export const IndicatorLegend = memo(function IndicatorLegend({
  indicators,
  onToggle,
  onRemove,
  className,
}: IndicatorLegendProps) {
  if (indicators.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {indicators.map((ind) => (
        <Tooltip key={ind.config.id}>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-background/80 backdrop-blur-sm border border-border/50",
                !ind.visible && "opacity-50"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: ind.color }}
              />
              <span className="text-foreground/80">{ind.config.id.toUpperCase()}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(ind.config.id);
                }}
                className="hover:text-foreground text-muted-foreground"
              >
                {ind.visible ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5" />}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(ind.config.id);
                }}
                className="hover:text-destructive text-muted-foreground"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <p className="font-medium">{ind.config.name}</p>
            {ind.params.period && (
              <p className="text-muted-foreground">Period: {ind.params.period}</p>
            )}
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
});
