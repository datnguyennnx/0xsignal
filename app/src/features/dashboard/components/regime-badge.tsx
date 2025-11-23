import { cn } from "@/core/utils/cn";

interface RegimeBadgeProps {
  regime: string;
  className?: string;
}

const regimeStyles = {
  BULL_MARKET: "bg-green-500/10 text-green-500 border-green-500/20",
  BEAR_MARKET: "bg-red-500/10 text-red-500 border-red-500/20",
  SIDEWAYS: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  HIGH_VOLATILITY: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  LOW_VOLATILITY: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  TRENDING: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  MEAN_REVERSION: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
};

export function RegimeBadge({ regime, className }: RegimeBadgeProps) {
  const style = regimeStyles[regime as keyof typeof regimeStyles] || regimeStyles.SIDEWAYS;

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
