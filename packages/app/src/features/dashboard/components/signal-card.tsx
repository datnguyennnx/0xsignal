import { useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatPercent, formatCurrency } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";

interface SignalCardProps {
  readonly signal: AssetAnalysis;
  readonly type: "buy" | "sell" | "hold";
}

export function SignalCard({ signal, type }: SignalCardProps) {
  const navigate = useNavigate();
  const isStrong =
    type !== "hold" && signal.overallSignal === (type === "buy" ? "STRONG_BUY" : "STRONG_SELL");
  const confidence = signal.confidence || 0;
  const price = signal.price?.price || 0;
  const change24h = signal.price?.change24h || 0;
  const riskScore = signal.riskScore || 0;
  const volume = signal.price?.volume24h || 0;

  return (
    <Card
      className="py-0 shadow-none cursor-pointer transition-all duration-300 ease-premium hover:bg-secondary/40 hover:-translate-y-[1px] hover:shadow-sm hover:border-border/80 active:scale-[0.99] group border-border/50 tap-highlight"
      onClick={() => navigate(`/asset/${signal.symbol.toLowerCase()}`)}
    >
      <CardContent className="p-3.5 sm:p-3">
        <div className="flex items-center justify-between">
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
              <div className="flex items-center gap-2.5 sm:gap-3 mt-1.5 sm:mt-1 text-[11px] sm:text-[10px] text-muted-foreground tabular-nums">
                <span className="sm:hidden">{confidence}%</span>
                <span className="hidden sm:inline" title="Confidence">
                  C:{confidence}%
                </span>
                <span title="Risk Score">R:{riskScore}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-medium tabular-nums tracking-tight leading-none mb-1.5 sm:mb-1">
              ${formatPrice(price)}
            </div>
            <div className="flex items-center justify-end gap-3 text-[11px] tabular-nums">
              <span className="hidden xl:block text-muted-foreground">
                Vol {formatCurrency(volume)}
              </span>
              <span className={cn("font-medium", change24h > 0 ? "text-gain" : "text-loss")}>
                {change24h > 0 ? "+" : ""}
                {formatPercent(change24h)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
