// Regime Badge - pure component

import { cn } from "@/core/utils/cn";

interface RegimeBadgeProps {
  regime: string;
  className?: string;
}

const regimeStyles: Record<string, string> = {
  BULL_MARKET: "bg-gain/10 text-gain border-gain/20",
  BEAR_MARKET: "bg-loss/10 text-loss border-loss/20",
  SIDEWAYS: "bg-muted text-muted-foreground border-border",
  HIGH_VOLATILITY: "bg-warn/10 text-warn border-warn/20",
  LOW_VOLATILITY: "bg-muted text-muted-foreground border-border",
  TRENDING: "bg-primary/10 text-foreground border-primary/20",
  MEAN_REVERSION: "bg-muted/10 text-muted-foreground border-muted/20",
};

export function RegimeBadge({ regime, className }: RegimeBadgeProps) {
  const style = regimeStyles[regime] || regimeStyles.SIDEWAYS;

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        style,
        className
      )}
    >
      {regime.replace(/_/g, " ")}
    </span>
  );
}
