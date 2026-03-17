import { memo } from "react";
import type { WyckoffAnalysisResult } from "../workers/wyckoff-worker";
import type { WyckoffVisibility } from "../types";
import { cn } from "@/core/utils/cn";

interface WyckoffLegendProps {
  analysis: WyckoffAnalysisResult;
  visibility: WyckoffVisibility;
}

export const WyckoffLegend = memo(function WyckoffLegend({
  analysis,
  visibility,
}: WyckoffLegendProps) {
  const hasVisibleItems = Object.values(visibility).some(Boolean);

  if (!hasVisibleItems) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-medium">
      {analysis.cycle !== "unknown" && (
        <span
          className={cn(
            analysis.cycle === "accumulation" && "text-gain",
            analysis.cycle === "distribution" && "text-loss",
            analysis.cycle === "markup" && "text-gain",
            analysis.cycle === "markdown" && "text-loss"
          )}
        >
          {analysis.cycle.toUpperCase()}
        </span>
      )}

      {analysis.currentPhase && (
        <span className="text-muted-foreground">Phase {analysis.currentPhase}</span>
      )}

      {visibility.tradingRange && analysis.tradingRange && (
        <span className="text-muted-foreground">
          TR: {analysis.tradingRange.low.toFixed(2)}-{analysis.tradingRange.high.toFixed(2)}
        </span>
      )}

      {visibility.climaxes && analysis.climaxes.length > 0 && (
        <span className="text-muted-foreground">{analysis.climaxes.length} Climax</span>
      )}

      {visibility.springs && analysis.events.length > 0 && (
        <span className="text-muted-foreground">{analysis.events.length} Events</span>
      )}
    </div>
  );
});
