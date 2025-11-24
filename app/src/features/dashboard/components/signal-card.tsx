import { memo } from "react";
import { useNavigate } from "react-router-dom";
import type { EnhancedAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { CryptoIcon } from "@/components/crypto-icon";

interface SignalCardProps {
  signal: EnhancedAnalysis;
  type: "buy" | "sell";
}

const SignalCardComponent = ({ signal, type }: SignalCardProps) => {
  const navigate = useNavigate();

  const overallSignal = signal.overallSignal;
  const isStrong = overallSignal === (type === "buy" ? "STRONG_BUY" : "STRONG_SELL");
  const confidence = signal.confidence || 0;
  const regime = signal.strategyResult?.regime;
  const strategy = signal.strategyResult?.primarySignal?.strategy || "N/A";
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const riskScore = signal.riskScore || 0;

  // Show regime if available
  const displayRegime = regime ? regime.replace(/_/g, " ") : null;

  return (
    <button
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
      className={cn(
        "w-full px-3 py-2.5 rounded-sm border transition-all text-left group",
        "hover:border-foreground/20 hover:shadow-sm",
        isStrong
          ? type === "buy"
            ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
            : "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
          : "border-border/50 hover:bg-accent/50"
      )}
    >
      <div className="flex items-center gap-4">
        {/* Symbol */}
        <div className="flex items-center gap-2.5 min-w-[120px]">
          <CryptoIcon symbol={signal.symbol} size={20} />
          <div className="flex flex-col">
            <span className="font-mono font-medium text-sm leading-tight">
              {signal.symbol.toUpperCase()}
            </span>
            {displayRegime && (
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {displayRegime}
              </span>
            )}
          </div>
        </div>

        {/* Strategy */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
            Strategy
          </div>
          <div className="text-xs font-medium truncate">{strategy}</div>
        </div>

        {/* Metrics Grid */}
        <div className="flex items-center gap-6 text-xs tabular-nums">
          <div className="text-right min-w-[70px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Price
            </div>
            <div className="font-medium">${price >= 1 ? price.toFixed(2) : price.toFixed(4)}</div>
          </div>

          <div className="text-right min-w-[50px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              24h
            </div>
            <div className={cn("font-medium", change24h > 0 ? "text-green-500" : "text-red-500")}>
              {change24h > 0 ? "+" : ""}
              {change24h.toFixed(1)}%
            </div>
          </div>

          <div className="text-right min-w-[45px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Conf
            </div>
            <div className={cn("font-medium", type === "buy" ? "text-green-500" : "text-red-500")}>
              {confidence}%
            </div>
          </div>

          <div className="text-right min-w-[40px]">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
              Risk
            </div>
            <div
              className={cn(
                "font-medium",
                riskScore > 70
                  ? "text-red-500"
                  : riskScore > 40
                    ? "text-orange-500"
                    : "text-green-500"
              )}
            >
              {riskScore}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export const SignalCard = memo(SignalCardComponent);
