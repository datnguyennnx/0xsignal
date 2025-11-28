// Signal Card - Mobile-first responsive design

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatPercent } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";

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
    <button
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
      className={cn(
        "w-full px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-sm border transition-all text-left",
        "active:scale-[0.99] hover:border-foreground/20",
        type === "hold"
          ? "border-border/30"
          : isStrong
            ? type === "buy"
              ? "border-gain/30 bg-gain/5"
              : "border-loss/30 bg-loss/5"
            : "border-border/50"
      )}
    >
      {/* Mobile: 2-row layout, Desktop: single row */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Symbol + Price */}
        <div className="flex items-center gap-2 min-w-0">
          <CryptoIcon symbol={signal.symbol} size={18} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-medium text-xs sm:text-sm">
                {signal.symbol.toUpperCase()}
              </span>
              {isStrong && (
                <span className="hidden sm:inline text-[9px] px-1 py-0.5 rounded bg-muted font-medium">
                  STRONG
                </span>
              )}
            </div>
            <div className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
              ${formatPrice(price)}
            </div>
          </div>
        </div>

        {/* Right: Key metrics */}
        <div className="flex items-center gap-3 sm:gap-4 text-right">
          {/* 24h Change - Always visible */}
          <div>
            <div className="hidden sm:block text-[9px] text-muted-foreground uppercase">24h</div>
            <div
              className={cn(
                "text-xs sm:text-sm font-medium tabular-nums",
                change24h > 0 ? "text-gain" : "text-loss"
              )}
            >
              {formatPercent(change24h)}
            </div>
          </div>

          {/* Confidence - Always visible */}
          <div>
            <div className="hidden sm:block text-[9px] text-muted-foreground uppercase">Conf</div>
            <div
              className={cn(
                "text-xs sm:text-sm font-medium tabular-nums",
                type === "buy" ? "text-gain" : type === "sell" ? "text-loss" : ""
              )}
            >
              {confidence}%
            </div>
          </div>

          {/* Risk - Hidden on mobile */}
          <div className="hidden sm:block">
            <div className="text-[9px] text-muted-foreground uppercase">Risk</div>
            <div
              className={cn(
                "text-sm font-medium tabular-nums",
                riskScore > 70 ? "text-loss" : riskScore > 40 ? "text-warn" : "text-gain"
              )}
            >
              {riskScore}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
