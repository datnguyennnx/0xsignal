/**
 * Signal Card - Mobile-first responsive design
 * Clean monochrome design, no colored backgrounds
 */

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SignalCardProps {
  readonly signal: AssetAnalysis;
  readonly type: "buy" | "sell" | "hold";
}

export function SignalCard({ signal, type }: SignalCardProps) {
  const navigate = useNavigate();

  const overallSignal = signal.overallSignal;
  const isStrong =
    type !== "hold" && overallSignal === (type === "buy" ? "STRONG_BUY" : "STRONG_SELL");
  const confidence = signal.confidence || 0;
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const riskScore = signal.riskScore || 0;

  return (
    <Card
      className="py-0 shadow-none cursor-pointer transition-all hover:shadow-sm active:scale-[0.995]"
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Left: Symbol + Price */}
          <div className="flex items-center gap-2.5 min-w-0">
            <CryptoIcon symbol={signal.symbol} size={20} className="shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-sm">{signal.symbol.toUpperCase()}</span>
                {isStrong && (
                  <Badge
                    variant="secondary"
                    className="hidden sm:inline-flex text-[9px] h-4 px-1.5"
                  >
                    STRONG
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                ${formatPrice(price)}
              </div>
            </div>
          </div>

          {/* Right: Key metrics */}
          <div className="flex items-center gap-4 sm:gap-5 text-right shrink-0">
            {/* 24h Change */}
            <div className="min-w-[48px]">
              <div className="hidden sm:block text-[9px] text-muted-foreground uppercase tracking-wide">
                24h
              </div>
              <div
                className={cn(
                  "text-sm font-medium tabular-nums",
                  change24h > 0 ? "text-gain" : "text-loss"
                )}
              >
                {formatPercent(change24h)}
              </div>
            </div>

            {/* Confidence */}
            <div className="min-w-[40px]">
              <div className="hidden sm:block text-[9px] text-muted-foreground uppercase tracking-wide">
                Conf
              </div>
              <div className="text-sm font-medium tabular-nums">{confidence}%</div>
            </div>

            {/* Risk - Hidden on mobile */}
            <div className="hidden sm:block min-w-[36px]">
              <div className="text-[9px] text-muted-foreground uppercase tracking-wide">Risk</div>
              <div className="text-sm font-medium tabular-nums">{riskScore}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
