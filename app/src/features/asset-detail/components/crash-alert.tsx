import { Alert, AlertDescription } from "@/ui/alert";
import { cn } from "@/core/utils/cn";

interface CrashAlertProps {
  isCrashing: boolean;
  severity: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  recommendation: string;
  className?: string;
}

export function CrashAlert({ isCrashing, severity, recommendation, className }: CrashAlertProps) {
  if (!isCrashing) return null;

  const severityStyles = {
    LOW: "border-yellow-500/50 bg-yellow-500/5",
    MEDIUM: "border-orange-500/50 bg-orange-500/5",
    HIGH: "border-red-500/50 bg-red-500/5",
    EXTREME: "border-red-600/50 bg-red-600/10",
  };

  const severityText = {
    LOW: "Low Severity",
    MEDIUM: "Medium Severity",
    HIGH: "High Severity",
    EXTREME: "Extreme Crash",
  };

  return (
    <Alert className={cn(severityStyles[severity], className)}>
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide">Crash Detected</span>
            <span className="text-xs text-muted-foreground">{severityText[severity]}</span>
          </div>
          <AlertDescription className="text-sm">{recommendation}</AlertDescription>
        </div>
      </div>
    </Alert>
  );
}
