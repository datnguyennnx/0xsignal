// Signal Table - Mobile-first responsive design

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { CryptoIcon } from "@/components/crypto-icon";

type SignalType = "buy" | "sell" | "hold";

interface SignalTableProps {
  signals: AssetAnalysis[];
  type: SignalType;
}

const strongSignalMap: Record<SignalType, string> = {
  buy: "STRONG_BUY",
  sell: "STRONG_SELL",
  hold: "",
};

// Mobile Card View
function SignalRow({ signal, type }: { signal: AssetAnalysis; type: SignalType }) {
  const navigate = useNavigate();
  const isStrong = signal.overallSignal === strongSignalMap[type];
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const volume24h = signal.price?.volume24h || 0;
  const riskScore = signal.riskScore || 0;
  const noiseValue = signal.noise?.value ?? 0;
  const isHold = type === "hold";

  return (
    <button
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
      className="w-full px-3 py-2.5 border-b border-border/30 text-left active:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Symbol */}
        <div className="flex items-center gap-2.5 min-w-0">
          <CryptoIcon symbol={signal.symbol} size={20} className="shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={cn("font-medium text-sm", isHold && "text-muted-foreground")}>
                {signal.symbol.toUpperCase()}
              </span>
              {isStrong && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-muted font-medium">STRONG</span>
              )}
            </div>
            <div className={cn("text-xs tabular-nums", isHold ? "text-muted-foreground" : "")}>
              ${formatPrice(price)}
            </div>
          </div>
        </div>

        {/* Right: Metrics */}
        <div className="flex items-center gap-4 text-right">
          {/* 24h Change */}
          <div>
            <div
              className={cn(
                "text-sm font-medium tabular-nums",
                isHold
                  ? change24h > 0
                    ? "text-gain/70"
                    : "text-loss/70"
                  : change24h > 0
                    ? "text-gain"
                    : "text-loss"
              )}
            >
              {formatPercentChange(change24h)}
            </div>
            <div className="text-[10px] text-muted-foreground sm:hidden">24h</div>
          </div>

          {/* Volume - Hidden on mobile */}
          <div className="hidden sm:block min-w-[60px]">
            <div className="text-sm tabular-nums text-muted-foreground">
              {formatCurrency(volume24h)}
            </div>
            <div className="text-[10px] text-muted-foreground">Vol</div>
          </div>

          {isHold ? (
            <>
              {/* Risk */}
              <div className="min-w-[32px]">
                <div
                  className={cn(
                    "text-sm tabular-nums",
                    riskScore > 60 ? "text-warn" : "text-muted-foreground"
                  )}
                >
                  {riskScore}
                </div>
                <div className="text-[10px] text-muted-foreground sm:hidden">Risk</div>
              </div>
              {/* Noise - Hidden on mobile */}
              <div className="hidden sm:block min-w-[32px]">
                <div
                  className={cn(
                    "text-sm tabular-nums",
                    noiseValue > 60 ? "text-warn" : "text-muted-foreground"
                  )}
                >
                  {noiseValue}
                </div>
                <div className="text-[10px] text-muted-foreground">Noise</div>
              </div>
            </>
          ) : (
            <div className="min-w-[40px]">
              <div className="text-sm font-medium tabular-nums">{signal.confidence || 0}%</div>
              <div className="text-[10px] text-muted-foreground sm:hidden">Conf</div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export function SignalTable({ signals, type }: SignalTableProps) {
  const isHold = type === "hold";

  if (signals.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {type === "buy" && "No bullish setups detected"}
          {type === "sell" && "No bearish setups detected"}
          {type === "hold" && "No neutral positions"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">Market conditions may have changed</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      {/* Desktop Header */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_60px_60px] gap-4 px-3 py-2 bg-muted/30 text-xs text-muted-foreground border-b">
        <div>Asset</div>
        <div className="text-right">24h Change</div>
        <div className="text-right">Volume</div>
        {isHold ? (
          <>
            <div className="text-right">Risk</div>
            <div className="text-right">Noise</div>
          </>
        ) : (
          <div className="text-right col-span-2">Confidence</div>
        )}
      </div>

      {/* Signal Rows */}
      <div className="divide-y divide-border/30">
        {signals.map((signal) => (
          <SignalRow key={signal.symbol} signal={signal} type={type} />
        ))}
      </div>
    </div>
  );
}
