import { memo } from "react";
import { useNavigate } from "react-router-dom";
import type { EnhancedAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatVolume } from "@/core/utils/formatters";
import { RegimeBadge } from "./regime-badge";

interface SignalCardProps {
  signal: EnhancedAnalysis;
  type: "buy" | "sell";
}

const SignalCardComponent = ({ signal, type }: SignalCardProps) => {
  const navigate = useNavigate();

  const overallSignal =
    signal.strategyAnalysis?.overallSignal || signal.quantAnalysis?.overallSignal;
  const isStrong = overallSignal === (type === "buy" ? "STRONG_BUY" : "STRONG_SELL");
  const confidence = signal.strategyAnalysis?.confidence || signal.quantAnalysis?.confidence || 0;
  const regime = signal.strategyAnalysis?.strategyResult?.regime;
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const volume24h = signal.price?.volume24h || 0;

  const colorClass = type === "buy" ? "green" : "red";

  return (
    <button
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
      className={cn(
        "w-full rounded-lg border p-3 transition-all text-left hover:shadow-md",
        isStrong
          ? `bg-${colorClass}-500/5 border-${colorClass}-500/50`
          : "bg-card hover:bg-accent/50"
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase">{signal.symbol}</span>
          {isStrong && (
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded bg-${colorClass}-500 text-white`}
            >
              STRONG
            </span>
          )}
          {regime && <RegimeBadge regime={regime} />}
        </div>
        <span className={`text-sm font-bold text-${colorClass}-500`}>{confidence}%</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Price</div>
          <div className="font-medium">${price.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-muted-foreground">24h</div>
          <div className={cn("font-medium", change24h > 0 ? "text-green-500" : "text-red-500")}>
            {change24h > 0 ? "+" : ""}
            {change24h.toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Volume</div>
          <div className="font-medium">{formatVolume(volume24h)}</div>
        </div>
      </div>
    </button>
  );
};

export const SignalCard = memo(SignalCardComponent);
