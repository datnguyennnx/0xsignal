import { Link } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";
import { MiniSparkline } from "@/features/dashboard/components/mini-sparkline";

interface TradeSetupCardProps {
  asset: AssetAnalysis;
}

const formatPrice = (p: number) => {
  if (p < 0.0001) return p.toFixed(8);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(2);
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function TradeSetupCard({ asset }: TradeSetupCardProps) {
  const entry = asset.entrySignal;
  const isLong = entry.direction === "LONG";
  const price = asset.price?.price || 0;
  const change = asset.price?.change24h || 0;
  const isPositive = change >= 0;

  return (
    <Card className="py-0 shadow-none hover:bg-secondary/30 transition-all active:scale-[0.98] group border-border/50 tap-highlight">
      <Link to={`/asset/${asset.symbol.toLowerCase()}`} className="block">
        <CardContent className="p-3.5 sm:p-3">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <CryptoIcon
                symbol={asset.symbol}
                image={asset.price?.image}
                size={24}
                className="shrink-0 opacity-90 sm:w-[22px] sm:h-[22px]"
              />
              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-bold tracking-tight leading-none">
                    {asset.symbol.toUpperCase()}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-medium uppercase tracking-wide leading-none",
                      isLong ? "text-gain" : "text-loss"
                    )}
                  >
                    {entry.direction}
                  </span>
                </div>
                <div className="text-[11px] sm:text-[10px] text-muted-foreground font-medium mt-1">
                  {entry.strength.replace("_", " ")}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div
                className={cn(
                  "text-sm font-medium tabular-nums tracking-tight leading-none mb-1",
                  isPositive ? "text-gain" : "text-loss"
                )}
              >
                {formatPrice(price)}
              </div>
              <div className="text-[11px] sm:text-[10px] text-muted-foreground tabular-nums">
                {isPositive ? "+" : ""}
                {change.toFixed(2)}%
              </div>
            </div>
          </div>
          <div className="hidden sm:block h-10 mb-3 opacity-60 group-hover:opacity-90 transition-opacity">
            <MiniSparkline
              symbol={asset.symbol}
              isPositive={isPositive}
              className="h-full w-full"
            />
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground tabular-nums">
            <div className="flex items-center gap-3">
              <span title="Confidence">C:{entry.confidence}%</span>
              <span title="Risk Score">R:{asset.riskScore}</span>
            </div>
            <span title="Risk:Reward">RR {entry.riskRewardRatio}:1</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
