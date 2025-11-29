/**
 * Regime Badge - Pure component using shadcn Badge
 */

import { cn } from "@/core/utils/cn";
import { Badge } from "@/components/ui/badge";

interface RegimeBadgeProps {
  regime: string;
  className?: string;
}

const regimeStyles: Record<string, string> = {
  BULL_MARKET: "bg-gain/10 text-gain border-gain/30",
  BEAR_MARKET: "bg-loss/10 text-loss border-loss/30",
  SIDEWAYS: "bg-muted text-muted-foreground border-border",
  HIGH_VOLATILITY: "bg-warn/10 text-warn border-warn/30",
  LOW_VOLATILITY: "bg-muted text-muted-foreground border-border",
  TRENDING: "bg-primary/10 text-foreground border-primary/30",
  MEAN_REVERSION: "bg-muted text-muted-foreground border-border",
};

export function RegimeBadge({ regime, className }: RegimeBadgeProps) {
  const style = regimeStyles[regime] || regimeStyles.SIDEWAYS;

  return (
    <Badge variant="outline" className={cn("text-[10px]", style, className)}>
      {regime.replace(/_/g, " ")}
    </Badge>
  );
}
