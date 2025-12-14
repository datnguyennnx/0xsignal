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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-1 bg-background/80 backdrop-blur-sm rounded text-[10px]">
      {analysis.cycle !== "unknown" && (
        <span
          className={cn(
            "font-medium",
            analysis.cycle === "accumulation" && "text-emerald-500",
            analysis.cycle === "distribution" && "text-rose-500",
            analysis.cycle === "markup" && "text-emerald-400",
            analysis.cycle === "markdown" && "text-rose-400"
          )}
        >
          {analysis.cycle.toUpperCase()}
        </span>
      )}

      {analysis.currentPhase && (
        <span className="text-muted-foreground">Phase {analysis.currentPhase}</span>
      )}

      {visibility.tradingRange && analysis.tradingRange && (
        <span className="text-indigo-400">
          TR: {analysis.tradingRange.low.toFixed(2)}-{analysis.tradingRange.high.toFixed(2)}
        </span>
      )}

      {visibility.climaxes && analysis.climaxes.length > 0 && (
        <span className="text-muted-foreground">{analysis.climaxes.length} climax</span>
      )}

      {visibility.springs && analysis.events.length > 0 && (
        <span className="text-muted-foreground">{analysis.events.length} events</span>
      )}
    </div>
  );
});
