import { memo } from "react";
import type { ActiveIndicator } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";

interface IndicatorChipsProps {
  indicators: ActiveIndicator[];
}

const toChipLabel = (indicator: ActiveIndicator): string => {
  const summary = indicator.config.params
    .map((param) => {
      const value = indicator.params[param.key];
      if (value === undefined) return null;
      return `${param.key}:${value}`;
    })
    .filter(Boolean)
    .join(" ");

  return summary ? `${indicator.config.name} ${summary}` : indicator.config.name;
};

export const IndicatorChips = memo(function IndicatorChips({ indicators }: IndicatorChipsProps) {
  if (indicators.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-12 left-2 right-2 z-20 pointer-events-none">
      <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto">
        {indicators.map((indicator) => (
          <div
            key={indicator.instanceId}
            className={cn(
              "flex items-center gap-1 rounded-xl border-border/30 bg-background/90 px-2 py-1 text-xs backdrop-blur",
              indicator.visible ? "" : "text-muted-foreground"
            )}
          >
            <span className="h-2 w-2 rounded-full bg-foreground/60" />
            <span className="max-w-[180px] truncate">{toChipLabel(indicator)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
