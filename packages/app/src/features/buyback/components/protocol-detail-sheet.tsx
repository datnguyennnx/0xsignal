import { memo } from "react";
import type { BuybackSignal } from "@0xsignal/shared";
import { cachedBuybackDetail } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/core/utils/cn";
import { formatCurrency, formatCompact } from "@/core/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ProtocolDetailPanelProps {
  readonly signal: BuybackSignal | null;
  readonly onClose: () => void;
}

function StatRow({
  label,
  value,
  subValue,
  variant,
}: {
  label: string;
  value: string;
  subValue?: string;
  variant?: "gain" | "loss" | "default";
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] sm:text-xs uppercase text-muted-foreground font-mono tracking-widest opacity-70">
        {label}
      </span>
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-lg sm:text-xl lg:text-2xl font-bold tabular-nums font-mono leading-none tracking-tight",
            variant === "gain" && "text-gain",
            variant === "loss" && "text-loss"
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] sm:text-xs font-mono text-muted-foreground opacity-60">
            {subValue}
          </span>
        )}
      </div>
    </div>
  );
}

function TrendBadge({ value }: { value: number | null }) {
  if (value === null) return null;
  const isPositive = value > 0;
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono",
        isPositive ? "bg-gain/10 text-gain" : value < 0 ? "bg-loss/10 text-loss" : "bg-muted"
      )}
    >
      <Icon className="h-3 w-3" />
      <span>
        {isPositive ? "+" : ""}
        {value.toFixed(1)}% 30d
      </span>
    </div>
  );
}

function YieldContext({ current, average1y }: { current: number; average1y: number | null }) {
  if (!average1y || average1y <= 0) return null;
  const ratio = current / average1y;
  const label =
    ratio >= 1.5
      ? "Well Above Average"
      : ratio >= 1.1
        ? "Above Average"
        : ratio >= 0.9
          ? "Near Average"
          : ratio >= 0.5
            ? "Below Average"
            : "Well Below Average";
  const variant = ratio >= 1.1 ? "gain" : ratio < 0.9 ? "loss" : "default";
  return (
    <div className="text-[10px] font-mono text-muted-foreground">
      <span className={cn(variant === "gain" && "text-gain", variant === "loss" && "text-loss")}>
        {label}
      </span>
      <span className="opacity-60"> vs 1Y avg ({formatCompact(average1y)}/day)</span>
    </div>
  );
}

function DetailContent({ protocol }: { protocol: string }) {
  const {
    data: detail,
    isLoading,
    isError,
  } = useEffectQuery(() => cachedBuybackDetail(protocol), [protocol]);

  if (isLoading) {
    return (
      <div className="space-y-8 pt-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="flex gap-8">
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-12 w-24" />
          <Skeleton className="h-12 w-24" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-xs font-mono">DATA UNAVAILABLE</p>
      </div>
    );
  }

  const yieldRate = detail.signal.annualizedBuybackRate;
  const growth = detail.signal.revenueGrowth7d ?? 0;
  const change30d = detail.signal.change30d;
  const average1y = detail.signal.average1y;

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Header Info */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {detail.signal.chains.map((chain) => (
            <Badge
              key={chain}
              variant="outline"
              className="font-mono text-[10px] uppercase px-2.5 py-1 border-border/40 font-normal text-muted-foreground/80"
            >
              {chain}
            </Badge>
          ))}
          <TrendBadge value={change30d} />
        </div>
        {detail.revenueSource && (
          <p className="text-sm font-medium text-muted-foreground leading-relaxed">
            {detail.revenueSource}
          </p>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-y-8 gap-x-4">
        <StatRow label="Daily Rev" value={formatCurrency(detail.signal.revenue24h)} />
        <div className="space-y-1">
          <StatRow
            label="Yield"
            value={`${yieldRate.toFixed(2)}%`}
            variant={yieldRate >= 10 ? "gain" : "default"}
          />
          <YieldContext current={yieldRate} average1y={average1y} />
        </div>
        <StatRow
          label="Market Cap"
          value={formatCurrency(detail.signal.marketCap)}
          subValue={
            detail.signal.impliedPE > 0 ? `PE ${detail.signal.impliedPE.toFixed(0)}x` : undefined
          }
        />
        <StatRow
          label="7d Growth"
          value={`${growth > 0 ? "+" : ""}${growth.toFixed(1)}%`}
          variant={growth > 0 ? "gain" : growth < 0 ? "loss" : "default"}
        />
      </div>

      {/* Revenue Chart Section */}
      {detail.dailyRevenue.length > 0 && (
        <div className="space-y-4 pt-2">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-60">
            Revenue Trend (30d)
          </span>
          <div className="rounded-xl bg-transparent -ml-2 -mr-2">
            <RevenueChart data={detail.dailyRevenue} />
          </div>
        </div>
      )}
    </div>
  );
}

export const ProtocolDetailPanel = memo(function ProtocolDetailPanel({
  signal,
  onClose,
}: ProtocolDetailPanelProps) {
  if (!signal) return null;
  const protocolSlug = signal.protocol.toLowerCase().replace(/\s+/g, "-");

  return (
    <aside className="w-full h-[100dvh] lg:h-full flex flex-col bg-background lg:bg-transparent overflow-hidden overscroll-contain lg:border-l lg:border-border/10">
      {/* Header */}
      <div className="shrink-0 pt-6 px-6 pb-2 flex items-start justify-between bg-transparent">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono">
              {signal.symbol.toUpperCase()}
            </h2>
            {signal.category && (
              <Badge
                variant="secondary"
                className="text-[10px] sm:text-xs h-6 px-2 font-mono tracking-wide font-normal bg-secondary/40 text-muted-foreground"
              >
                {signal.category}
              </Badge>
            )}
          </div>
          <span className="text-xs sm:text-sm font-mono text-muted-foreground uppercase tracking-wider pl-0.5 opacity-60">
            {signal.protocol}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -mr-2 text-muted-foreground/50 hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 lg:pb-12 custom-scrollbar">
        <DetailContent protocol={protocolSlug} />
      </div>
    </aside>
  );
});
