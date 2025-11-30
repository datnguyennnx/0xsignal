/**
 * Signal Overview Card - Minimalist design
 * Clean, monochrome with semantic colors only for price change and direction
 */

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
    <Card
      className={cn(
        "py-0 shadow-none cursor-pointer transition-all hover:shadow-sm active:scale-[0.995]",
        className
      )}
      onClick={() => navigate(`/asset/${asset.symbol.toLowerCase()}`)}
    >
      <CardContent className="p-4">
        {/* Row 1: Symbol + Price */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <CryptoIcon
              symbol={asset.symbol}
              image={asset.price?.image}
              size={20}
              className="shrink-0"
            />
            <span className="font-mono text-sm font-medium">{asset.symbol.toUpperCase()}</span>
          </div>
          <span className="text-sm font-medium tabular-nums">
            ${formatPrice(price?.price || 0)}
          </span>
        </div>

        {/* Row 2: Change + Setup */}
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              isPositive ? "text-gain" : "text-loss"
            )}
          >
            {formatPercent(change24h)}
          </span>
          {hasSetup ? (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                isLong ? "text-gain border-gain/30" : "text-loss border-loss/30"
              )}
            >
              {entry.direction} · {entry.strength.replace("_", " ")}
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">No setup</span>
          )}
        </div>

        {/* Row 3: Metrics */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="tabular-nums">Conf {asset.confidence}%</span>
          <span className="tabular-nums">Risk {asset.riskScore}</span>
        </div>
      </CardContent>
    </Card>
  );
}
