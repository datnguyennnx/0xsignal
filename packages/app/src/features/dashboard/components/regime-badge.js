import { jsx as _jsx } from "react/jsx-runtime";
// Regime Badge - pure component
import { cn } from "@/core/utils/cn";
const regimeStyles = {
  BULL_MARKET: "bg-gain/10 text-gain border-gain/20",
  BEAR_MARKET: "bg-loss/10 text-loss border-loss/20",
  SIDEWAYS: "bg-muted text-muted-foreground border-border",
  HIGH_VOLATILITY: "bg-warn/10 text-warn border-warn/20",
  LOW_VOLATILITY: "bg-muted text-muted-foreground border-border",
  TRENDING: "bg-primary/10 text-foreground border-primary/20",
  MEAN_REVERSION: "bg-muted/10 text-muted-foreground border-muted/20",
};
export function RegimeBadge({ regime, className }) {
  const style = regimeStyles[regime] || regimeStyles.SIDEWAYS;
  return _jsx("span", {
    className: cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
      style,
      className
    ),
    children: regime.replace(/_/g, " "),
  });
}
//# sourceMappingURL=regime-badge.js.map
