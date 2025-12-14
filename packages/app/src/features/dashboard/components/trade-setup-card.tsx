import { memo } from "react";
import { Link } from "react-router-dom";
import type { AssetAnalysis, ChartDataPoint } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";
import { MiniSparkline } from "@/features/dashboard/components/mini-sparkline";
import { Landmark } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface TradeSetupCardProps {
  asset: AssetAnalysis;
  hasInstitutionalHoldings?: boolean;
  chartData?: ChartDataPoint[]; // Optional pre-fetched data
}

const formatPrice = (p: number) => {
  if (p < 0.0001) return p.toFixed(8);
  if (p < 0.01) return p.toFixed(6);
  if (p < 1) return p.toFixed(4);
  if (p < 100) return p.toFixed(2);
  return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const getRiskColor = (score: number) => {
  if (score < 30) return "text-gain";
  if (score < 50) return "text-muted-foreground";
  if (score < 75) return "text-warn";
  return "text-loss";
};

export const TradeSetupCard = memo(function TradeSetupCard({
  asset,
  hasInstitutionalHoldings = false,
  chartData,
}: TradeSetupCardProps) {
  const entry = asset.entrySignal;
  const isLong = entry.direction === "LONG";
  const price = asset.price?.price || 0;
  const change = asset.price?.change24h || 0;
  const isPositive = change >= 0;
  const showInstitutional =
    hasInstitutionalHoldings &&
    ["btc", "eth", "bitcoin", "ethereum"].includes(asset.symbol.toLowerCase());

  return (
    <Card className="py-0 shadow-none hover:bg-secondary/40 transition-all duration-300 ease-premium hover:-translate-y-[1px] hover:shadow-sm hover:border-border/80 active:scale-[0.99] group border-border/50 tap-highlight">
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
                  {showInstitutional && (
                    <div className="flex items-center gap-1 ml-0.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            <Landmark size={10} className="text-muted-foreground/70" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          Institutional holdings
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
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
              data={chartData}
            />
          </div>
          <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px] text-muted-foreground tabular-nums">
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">S:{entry.confidence}%</span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] max-w-48">
                  Signal strength based on indicator alignment
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn("cursor-help", getRiskColor(asset.riskScore))}>
                    R:{asset.riskScore}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] max-w-48">
                  <p className="font-medium mb-0.5">Risk Score</p>
                  <p className="text-muted-foreground">
                    {asset.riskScore < 30
                      ? "Low risk environment"
                      : asset.riskScore < 50
                        ? "Moderate risk"
                        : asset.riskScore < 75
                          ? "Elevated risk"
                          : "High risk zone"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span title="Risk:Reward">RR {entry.riskRewardRatio}:1</span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
});
