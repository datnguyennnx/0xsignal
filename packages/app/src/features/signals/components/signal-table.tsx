/**
 * Signal Table - Card-based vertical layout
 * Better UX with stacked information instead of horizontal columns
 */

import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

function SignalItem({ signal, type }: { signal: AssetAnalysis; type: SignalType }) {
  const navigate = useNavigate();
  const isStrong = signal.overallSignal === strongSignalMap[type];
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const confidence = signal.confidence || 0;
  const riskScore = signal.riskScore || 0;
  const volume = signal.price?.volume24h || 0;
  const isHold = type === "hold";

  return (
    <Card
      className={cn(
        "py-0 shadow-none cursor-pointer transition-all hover:bg-secondary/30 active:scale-[0.98] group border-border/50 tap-highlight",
        isHold && "opacity-80"
      )}
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
    >
      <CardContent className="p-3.5 sm:p-3">
        <div className="flex items-center justify-between">
          {/* Left: Symbol & Context */}
          <div className="flex items-center gap-3">
            <CryptoIcon
              symbol={signal.symbol}
              image={signal.price?.image}
              size={24}
              className="shrink-0 opacity-90 sm:w-[22px] sm:h-[22px]"
            />
            <div className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-mono font-bold text-sm tracking-tight leading-none">
                  {signal.symbol.toUpperCase()}
                </span>
                {isStrong && (
                  <span className="text-[9px] font-semibold text-foreground/80 uppercase tracking-wider leading-none">
                    Strong
                  </span>
                )}
              </div>

              {/* Mobile: Show simplified context | Desktop: Full metrics */}
              <div className="flex items-center gap-2.5 sm:gap-3 mt-1.5 sm:mt-1 text-[11px] sm:text-[10px] text-muted-foreground tabular-nums">
                <span className="sm:hidden">{confidence}%</span>
                <span className="hidden sm:inline" title="Confidence">
                  C:{confidence}%
                </span>
                {!isHold && <span title="Risk Score">R:{riskScore}</span>}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-sm font-medium tabular-nums tracking-tight leading-none mb-1.5 sm:mb-1">
              ${formatPrice(price)}
            </div>
            <div className="flex items-center justify-end gap-3 text-[11px] tabular-nums">
              {/* Desktop+: Show Volume */}
              <span className="hidden xl:block text-muted-foreground">
                Vol {formatCurrency(volume)}
              </span>

              <span className={cn("font-medium", change24h > 0 ? "text-gain" : "text-loss")}>
                {change24h > 0 ? "+" : ""}
                {formatPercentChange(change24h)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SignalTable({ signals, type }: SignalTableProps) {
  if (signals.length === 0) {
    return (
      <Card className="py-0 shadow-none">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {type === "buy" && "No bullish setups detected"}
            {type === "sell" && "No bearish setups detected"}
            {type === "hold" && "No neutral positions"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Market conditions may have changed</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-responsive">
      {signals.map((signal) => (
        <SignalItem key={signal.symbol} signal={signal} type={type} />
      ))}
    </div>
  );
}
