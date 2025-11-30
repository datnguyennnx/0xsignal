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
  const volume24h = signal.price?.volume24h || 0;
  const confidence = signal.confidence || 0;
  const riskScore = signal.riskScore || 0;
  const noiseValue = signal.noise?.value ?? 0;
  const isHold = type === "hold";

  return (
    <Card
      className={cn(
        "py-0 shadow-none cursor-pointer transition-all hover:shadow-sm active:scale-[0.995]",
        isHold && "opacity-80"
      )}
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
    >
      <CardContent className="p-4">
        {/* Row 1: Symbol + Price + Change */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <CryptoIcon
              symbol={signal.symbol}
              image={signal.price?.image}
              size={24}
              className="shrink-0"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-medium text-sm">{signal.symbol.toUpperCase()}</span>
                {isStrong && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                    STRONG
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground tabular-nums">
                ${formatPrice(price)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "text-sm font-medium tabular-nums",
                change24h > 0 ? "text-gain" : "text-loss"
              )}
            >
              {formatPercentChange(change24h)}
            </div>
            <div className="text-[10px] text-muted-foreground">24h</div>
          </div>
        </div>

        {/* Row 2: Metrics */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50">
          <div className="flex items-center gap-4 text-xs">
            <div>
              <span className="text-muted-foreground">Vol </span>
              <span className="tabular-nums">{formatCurrency(volume24h)}</span>
            </div>
            {isHold ? (
              <>
                <div>
                  <span className="text-muted-foreground">Risk </span>
                  <span
                    className={cn("tabular-nums font-medium", riskScore > 60 ? "text-warn" : "")}
                  >
                    {riskScore}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Noise </span>
                  <span
                    className={cn("tabular-nums font-medium", noiseValue > 60 ? "text-warn" : "")}
                  >
                    {noiseValue}
                  </span>
                </div>
              </>
            ) : (
              <div>
                <span className="text-muted-foreground">Conf </span>
                <span
                  className={cn(
                    "tabular-nums font-medium",
                    type === "buy" ? "text-gain" : type === "sell" ? "text-loss" : ""
                  )}
                >
                  {confidence}%
                </span>
              </div>
            )}
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {signals.map((signal) => (
        <SignalItem key={signal.symbol} signal={signal} type={type} />
      ))}
    </div>
  );
}
