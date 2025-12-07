import type { AssetAnalysis, AssetContext } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Landmark, Zap, TrendingUp } from "lucide-react";
import { EstimateBadge } from "@/components/data-freshness";

interface UnifiedSignalCardProps {
  analysis: AssetAnalysis;
  context?: AssetContext | null;
  className?: string;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatCompact = (n: number) => {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

const calculatePct = (start: number, end: number) => {
  if (!start || start === 0) return 0;
  return ((end - start) / start) * 100;
};

const getSignalColor = (signal: string) =>
  signal.includes("BUY") ? "text-gain" : signal.includes("SELL") ? "text-loss" : "text-foreground";

const getRiskColor = (level: string) => {
  if (level === "LOW") return "text-gain";
  if (level === "MEDIUM") return "text-muted-foreground";
  if (level === "HIGH") return "text-warn";
  return "text-loss";
};

export function UnifiedSignalCard({ analysis, context, className }: UnifiedSignalCardProps) {
  const { overallSignal, confidence, riskScore, entrySignal, strategyResult } = analysis;
  const { entryPrice, targetPrice, stopLoss, direction, riskRewardRatio } = entrySignal;
  const hasDirection = direction !== "NEUTRAL";
  const targetPct = hasDirection ? Math.abs(calculatePct(entryPrice, targetPrice)) : 0;
  const stopPct = hasDirection ? Math.abs(calculatePct(entryPrice, stopLoss)) : 0;

  const { treasury, derivatives, riskContext } = context || {};
  const hasContext = treasury || derivatives;

  return (
    <Card className={cn("w-full bg-card border-border/40 shadow-none p-5", className)}>
      <div className="flex flex-col space-y-5">
        {/* Signal Header */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium uppercase tracking-widest text-muted-foreground">
              {strategyResult.regime.replace(/_/g, " ")}
            </span>
            <span className="text-xs sm:text-sm font-mono text-muted-foreground">
              CONF {confidence}%
            </span>
          </div>
          <div className="flex items-baseline gap-3">
            <h2
              className={cn(
                "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-none",
                getSignalColor(overallSignal)
              )}
            >
              {overallSignal.replace(/_/g, " ")}
            </h2>
            <Badge
              variant="secondary"
              className="h-6 sm:h-7 px-2 text-xs font-mono uppercase tracking-wide text-muted-foreground bg-secondary/50 hover:bg-secondary/50 border-0 rounded-sm"
            >
              {direction}
            </Badge>
          </div>
        </div>

        {/* Entry Price */}
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl sm:text-6xl lg:text-7xl font-mono font-medium tracking-tighter text-foreground tabular-nums">
              {formatCurrency(entryPrice)}
            </span>
            <span className="text-sm sm:text-base text-muted-foreground font-medium">USD</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground uppercase tracking-wider mt-1">
            Suggested Entry Zone
          </p>
        </div>

        {/* Targets & Risk */}
        {hasDirection && (
          <div className="grid grid-cols-3 gap-4 lg:flex lg:flex-col lg:gap-0 lg:space-y-3">
            <TickerItem
              label="Target"
              value={formatCurrency(targetPrice)}
              subValue={`+${targetPct.toFixed(2)}%`}
              highlight="gain"
            />
            <TickerItem
              label="Stop"
              value={formatCurrency(stopLoss)}
              subValue={`-${stopPct.toFixed(2)}%`}
              highlight="loss"
            />
            <TickerItem
              label={riskContext ? "Smart Risk" : "Risk Score"}
              value={`${riskContext ? riskContext.finalRisk : riskScore}/100`}
              subValue={`1:${riskRewardRatio}`}
              highlight="neutral"
              tooltip={
                riskContext ? (
                  <div className="max-w-56 text-[10px]">
                    <p className="font-medium mb-1">Smart Risk: {riskContext.riskLevel}</p>
                    <p className="text-muted-foreground mb-1">Base Score: {riskScore}</p>
                    <p className="text-muted-foreground border-t border-border/50 pt-1 mt-1">
                      {riskContext.explanation}
                    </p>
                  </div>
                ) : undefined
              }
            />
          </div>
        )}

        {/* Context Section */}
        {hasContext && (
          <div className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Context
              </span>
            </div>

            <div className="space-y-2">
              {treasury?.hasInstitutionalHoldings && (
                <DataRow
                  icon={<Landmark size={14} className="text-muted-foreground" />}
                  label="Treasury"
                  value={`$${formatCompact(treasury.totalHoldingsUsd)}`}
                  subValue={`${treasury.entityCount} entities`}
                  highlight={
                    treasury.accumulationSignal === "buy" ||
                    treasury.accumulationSignal === "strong_buy"
                      ? "gain"
                      : treasury.accumulationSignal === "sell" ||
                          treasury.accumulationSignal === "strong_sell"
                        ? "loss"
                        : "neutral"
                  }
                />
              )}

              {derivatives && (
                <DataRow
                  icon={<TrendingUp size={14} className="text-muted-foreground" />}
                  label="Open Interest"
                  value={`$${formatCompact(derivatives.openInterestUsd)}`}
                  subValue={`${derivatives.oiChange24h >= 0 ? "+" : ""}${derivatives.oiChange24h.toFixed(1)}%`}
                  highlight={
                    derivatives.oiChange24h > 5
                      ? "gain"
                      : derivatives.oiChange24h < -5
                        ? "loss"
                        : "neutral"
                  }
                />
              )}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-border/30">
          <p className="text-[9px] text-muted-foreground/50">Not financial advice. DYOR.</p>
        </div>
      </div>
    </Card>
  );
}

function TickerItem({
  label,
  value,
  subValue,
  highlight,
  tooltip,
}: {
  label: string;
  value: string;
  subValue: string;
  highlight: "gain" | "loss" | "neutral";
  tooltip?: React.ReactNode;
}) {
  const subColor =
    highlight === "gain"
      ? "text-gain"
      : highlight === "loss"
        ? "text-loss"
        : "text-muted-foreground";

  const content = (
    <div className="flex flex-col space-y-0.5 lg:flex-row lg:justify-between lg:items-center lg:space-y-0 lg:border-b lg:border-border/40 lg:pb-2 lg:last:border-0 lg:last:pb-0">
      <span className="text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground/70 decoration-dotted underline-offset-2 hover:underline cursor-help">
        {label}
      </span>
      <div className="flex flex-col lg:flex-row lg:items-baseline lg:gap-2">
        <span className="text-base sm:text-lg font-mono font-medium text-foreground tabular-nums leading-tight">
          {value}
        </span>
        <span
          className={cn(
            "text-[10px] sm:text-xs font-mono tabular-nums leading-none lg:text-right",
            subColor
          )}
        >
          {subValue}
        </span>
      </div>
    </div>
  );

  const plainContent = (
    <div className="flex flex-col space-y-0.5 lg:flex-row lg:justify-between lg:items-center lg:space-y-0 lg:border-b lg:border-border/40 lg:pb-2 lg:last:border-0 lg:last:pb-0">
      <span className="text-[9px] uppercase tracking-widest text-muted-foreground/70">{label}</span>
      <div className="flex flex-col lg:flex-row lg:items-baseline lg:gap-2">
        <span className="text-sm font-mono font-medium text-foreground tabular-nums leading-tight">
          {value}
        </span>
        <span
          className={cn("text-[10px] font-mono tabular-nums leading-none lg:text-right", subColor)}
        >
          {subValue}
        </span>
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="left">{tooltip}</TooltipContent>
      </Tooltip>
    );
  }

  return plainContent;
}

function DataRow({
  icon,
  label,
  value,
  subValue,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
  highlight: "gain" | "loss" | "warn" | "neutral";
}) {
  const subColor =
    highlight === "gain"
      ? "text-gain"
      : highlight === "loss"
        ? "text-loss"
        : highlight === "warn"
          ? "text-warn"
          : "text-muted-foreground";

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground/80">
          {label}
        </span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-xs sm:text-sm font-mono font-medium tabular-nums">{value}</span>
        <span className={cn("text-[10px] font-mono tabular-nums", subColor)}>{subValue}</span>
      </div>
    </div>
  );
}
