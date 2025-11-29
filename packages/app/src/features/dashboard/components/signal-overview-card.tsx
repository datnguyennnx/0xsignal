/**
 * Signal Overview Card - Minimalist design
 * Clean, monochrome with semantic colors only for price change and direction
 * Consistent with other cards in the system
 */

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";

interface SignalOverviewCardProps {
  asset: AssetAnalysis;
  className?: string;
}

export function SignalOverviewCard({ asset, className }: SignalOverviewCardProps) {
  const navigate = useNavigate();

  const price = asset.price;
  const change24h = price?.change24h || 0;
  const isPositive = change24h >= 0;
  const entry = asset.entrySignal;
  const hasSetup = entry?.isOptimalEntry && entry?.direction !== "NEUTRAL";
  const isLong = entry?.direction === "LONG";

  return (
    <button
      onClick={() => navigate(`/asset/${asset.symbol.toLowerCase()}`)}
      className={cn(
        "w-full text-left rounded border border-border/50 p-3 sm:p-4 transition-colors",
        "hover:border-foreground/20 active:scale-[0.99]",
        className
      )}
    >
      {/* Row 1: Symbol + Price */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <CryptoIcon symbol={asset.symbol} size={18} className="shrink-0" />
          <span className="font-mono text-sm font-medium">{asset.symbol.toUpperCase()}</span>
        </div>
        <span className="text-sm font-medium tabular-nums">${formatPrice(price?.price || 0)}</span>
      </div>

      {/* Row 2: Change + Setup */}
      <div className="flex items-center justify-between text-[10px] sm:text-xs">
        <span className={cn("tabular-nums", isPositive ? "text-gain" : "text-loss")}>
          {formatPercent(change24h)}
        </span>
        {hasSetup ? (
          <span className={cn("font-medium", isLong ? "text-gain" : "text-loss")}>
            {entry.direction} · {entry.strength.replace("_", " ")}
          </span>
        ) : (
          <span className="text-muted-foreground">No setup</span>
        )}
      </div>

      {/* Row 3: Metrics */}
      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
        <span>Conf {asset.confidence}%</span>
        <span>Risk {asset.riskScore}</span>
      </div>
    </button>
  );
}
