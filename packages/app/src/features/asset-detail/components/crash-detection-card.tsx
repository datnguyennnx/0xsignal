/**
 * Crash Detection Card - Minimalist design
 * Clean, monochrome with semantic colors only for severity
 * Consistent layout with trade-setup-card
 */

import type { CrashSignal } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";

interface CrashDetectionCardProps {
  crash: CrashSignal;
  className?: string;
}

export function CrashDetectionCard({ crash, className }: CrashDetectionCardProps) {
  const activeCount = Object.values(crash.indicators).filter(Boolean).length;
  const severityColor =
    crash.severity === "EXTREME" || crash.severity === "HIGH"
      ? "text-loss"
      : crash.severity === "MEDIUM"
        ? "text-warn"
        : "text-muted-foreground";

  return (
    <div className={cn("rounded border border-border/50", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-b border-border/50">
        <span className="text-xs sm:text-sm font-medium">Crash Detection</span>
        <span className={cn("text-[10px] sm:text-xs font-medium", severityColor)}>
          {crash.severity}
        </span>
      </div>

      {/* Indicators - Consistent 2-col grid */}
      <div className="grid grid-cols-2 px-3 py-2 sm:px-4 sm:py-3 gap-y-2 gap-x-4">
        <div className="flex items-center justify-between text-[10px] sm:text-xs">
          <span className="text-muted-foreground">Rapid Drop</span>
          <span
            className={
              crash.indicators.rapidDrop ? "text-loss font-medium" : "text-muted-foreground"
            }
          >
            {crash.indicators.rapidDrop ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] sm:text-xs">
          <span className="text-muted-foreground">Volume Spike</span>
          <span
            className={
              crash.indicators.volumeSpike ? "text-loss font-medium" : "text-muted-foreground"
            }
          >
            {crash.indicators.volumeSpike ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] sm:text-xs">
          <span className="text-muted-foreground">Oversold</span>
          <span
            className={
              crash.indicators.oversoldExtreme ? "text-loss font-medium" : "text-muted-foreground"
            }
          >
            {crash.indicators.oversoldExtreme ? "Yes" : "No"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] sm:text-xs">
          <span className="text-muted-foreground">High Vol</span>
          <span
            className={
              crash.indicators.highVolatility ? "text-loss font-medium" : "text-muted-foreground"
            }
          >
            {crash.indicators.highVolatility ? "Yes" : "No"}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 border-t border-border/50 text-[10px] sm:text-xs text-muted-foreground">
        <span>{activeCount}/4 active</span>
        <span>Confidence {crash.confidence}%</span>
      </div>
    </div>
  );
}
