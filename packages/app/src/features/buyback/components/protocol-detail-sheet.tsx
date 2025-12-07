import { memo } from "react";
import type { BuybackSignal } from "@0xsignal/shared";
import { cachedBuybackDetail } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/core/utils/cn";
import { formatCurrency } from "@/core/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

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
      <span className="text-[10px] uppercase text-muted-foreground font-mono tracking-widest opacity-70">
        {label}
      </span>
      <div className="flex flex-col gap-0.5">
        <span
          className={cn(
            "text-lg font-bold tabular-nums font-mono leading-none tracking-tight",
            variant === "gain" && "text-gain",
            variant === "loss" && "text-loss"
          )}
        >
          {value}
        </span>
        {subValue && (
          <span className="text-[10px] font-mono text-muted-foreground opacity-60">{subValue}</span>
        )}
      </div>
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

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Description / Revenue Source - Top "Bio" */}
      {detail.revenueSource && (
        <div className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {detail.revenueSource}
        </div>
      )}

      {/* Key Metrics Row */}
      <div className="grid grid-cols-2 gap-y-6 gap-x-4 sm:grid-cols-4">
        <StatRow label="Daily Rev" value={formatCurrency(detail.signal.revenue24h)} />
        <StatRow
          label="Yield"
          value={`${yieldRate.toFixed(2)}%`}
          variant={yieldRate >= 10 ? "gain" : "default"}
        />
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

      {/* Revenue Chart */}
      {detail.dailyRevenue.length > 0 && (
        <div className="space-y-4">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-50 px-1">
            Revenue Trend (30d)
          </span>
          <div className="rounded-xl bg-transparent -ml-2 -mr-2">
            <RevenueChart data={detail.dailyRevenue} />
          </div>
        </div>
      )}

      {/* Chains */}
      <div className="space-y-3 pt-4 border-t border-border/10">
        <div className="flex flex-wrap gap-2">
          {detail.signal.chains.map((chain) => (
            <Badge
              key={chain}
              variant="outline"
              className="font-mono text-[10px] px-2.5 py-1 border-border/40 font-normal text-muted-foreground/80 hover:bg-muted/30"
            >
              {chain}
            </Badge>
          ))}
        </div>
      </div>
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
            <h2 className="text-2xl font-bold tracking-tight font-mono">
              {signal.symbol.toUpperCase()}
            </h2>
            {signal.category && (
              <Badge
                variant="secondary"
                className="text-[9px] h-5 px-1.5 font-mono tracking-wide font-normal bg-secondary/40 text-muted-foreground"
              >
                {signal.category}
              </Badge>
            )}
          </div>
          <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider pl-0.5 opacity-60">
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
