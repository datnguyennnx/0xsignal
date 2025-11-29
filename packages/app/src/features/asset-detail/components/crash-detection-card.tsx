/**
 * Crash Detection Card - Minimalist design
 * Clean, monochrome with semantic colors only for severity
 * Uses Card component with softer rounded corners
 */

import type { CrashSignal } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

  const severityBorderColor =
    crash.severity === "EXTREME" || crash.severity === "HIGH"
      ? "border-loss/30"
      : crash.severity === "MEDIUM"
        ? "border-warn/30"
        : "border-border/50";

  return (
    <Card className={cn("py-0 shadow-none overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Crash Detection</CardTitle>
          <Badge
            variant="outline"
            className={cn("text-[10px]", severityColor, severityBorderColor)}
          >
            {crash.severity}
          </Badge>
        </div>
      </CardHeader>

      {/* Indicators */}
      <CardContent className="px-4 py-3">
        <div className="grid grid-cols-2 gap-3">
          <IndicatorRow label="Rapid Drop" active={crash.indicators.rapidDrop} />
          <IndicatorRow label="Volume Spike" active={crash.indicators.volumeSpike} />
          <IndicatorRow label="Oversold" active={crash.indicators.oversoldExtreme} />
          <IndicatorRow label="High Vol" active={crash.indicators.highVolatility} />
        </div>
      </CardContent>

      {/* Footer */}
      <CardContent className="px-4 py-3 border-t border-border/50">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">{activeCount}/4 active</span>
          <span className="tabular-nums">Confidence {crash.confidence}%</span>
        </div>
      </CardContent>
    </Card>
  );
}

function IndicatorRow({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge
        variant={active ? "destructive" : "secondary"}
        className={cn("text-[10px] h-5", !active && "text-muted-foreground")}
      >
        {active ? "Yes" : "No"}
      </Badge>
    </div>
  );
}
