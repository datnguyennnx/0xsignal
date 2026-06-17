import { memo } from "react";
import type { ActiveIndicator } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { toChipLabel } from "../utils/indicator-param-utils";

interface IndicatorChipsProps {
  indicators: ActiveIndicator[];
}

export const IndicatorChips = memo(function IndicatorChips({ indicators }: IndicatorChipsProps) {
  if (indicators.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-12 left-2 right-2 z-20 pointer-events-none">
      <div className="flex flex-nowrap overflow-x-auto scrollbar-hide items-center gap-[clamp(0.2rem,0.4vw,0.375rem)] pointer-events-auto">
        {indicators.map((indicator) => (
          <div
            key={indicator.instanceId}
            className={cn(
              "flex items-center gap-[clamp(0.15rem,0.3vw,0.25rem)] rounded-xl border-border/30 bg-background/90 px-2 py-1 text-[clamp(0.5625rem,0.6rem+0.4vw,0.6875rem)] backdrop-blur shrink-0",
              indicator.visible ? "" : "text-muted-foreground",
            )}
          >
            <span className="h-2 w-2 rounded-full bg-foreground/60 shrink-0" />
            <span className="max-w-[clamp(5rem,25vw,7.5rem)] truncate">
              {toChipLabel(indicator)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
