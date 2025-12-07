import { useState, useMemo, useEffect } from "react";
import { cachedHeatmap } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { MarketHeatmapComponent } from "../components/market-heatmap";

import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { useResponsiveDataCount } from "@/core/hooks/use-responsive-data-count";
import { formatCompact } from "@/core/utils/formatters";
const SM_BREAKPOINT = 640;

export function MarketDepthPage() {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= SM_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= SM_BREAKPOINT);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const dataLimit = useResponsiveDataCount({ mobile: 5, tablet: 10, desktop: 20, desktop4k: 40 });

  const { data: heatmapData, isLoading } = useEffectQuery(
    () => cachedHeatmap(dataLimit),
    [dataLimit]
  );

  const heatmapStats = useMemo(() => {
    if (!heatmapData?.cells?.length) return null;
    const cells = heatmapData.cells;
    const gainers = cells.filter((c) => c.change24h > 0);
    const losers = cells.filter((c) => c.change24h < 0);
    const totalMcap = cells.reduce((sum, c) => sum + c.marketCap, 0);
    const avgChange = cells.reduce((sum, c) => sum + c.change24h, 0) / cells.length;
    return {
      totalAssets: cells.length,
      gainers: gainers.length,
      losers: losers.length,
      totalMcap,
      avgChange,
    };
  }, [heatmapData]);

  return (
    <div className="h-full flex flex-col container-fluid py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-2 duration-500 ease-premium">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4 shrink-0 border-b border-border/40 pb-3 sm:pb-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase">
          Market Structure
        </h1>
        <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-sm self-start sm:self-auto">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs font-mono rounded-sm transition-all bg-background shadow-sm pointer-events-none"
          >
            HEATMAP
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <HeatmapStats stats={heatmapStats} />
      </div>

      <div className="flex-1 min-h-[300px] sm:min-h-0 border border-border/50 bg-card/30 rounded-sm overflow-hidden relative">
        {isLoading ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <MarketHeatmapComponent data={heatmapData!} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}

function HeatmapStats({ stats }: { stats: any }) {
  if (!stats) return <div className="h-12" />;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 shrink-0">
      <StatItem
        label="Assets"
        value={stats.totalAssets}
        subValue={
          <span>
            <span className="text-gain">{stats.gainers}</span>
            {" / "}
            <span className="text-loss">{stats.losers}</span>
          </span>
        }
      />
      <StatItem label="MCap" value={`$${formatCompact(stats.totalMcap)}`} />
      <StatItem
        label="Avg Change"
        value={`${stats.avgChange >= 0 ? "+" : ""}${stats.avgChange.toFixed(2)}%`}
        valueClass={stats.avgChange >= 0 ? "text-gain" : "text-loss"}
      />
    </div>
  );
}

function StatItem({
  label,
  value,
  subValue,
  valueClass,
}: {
  label: string;
  value: string | number;
  subValue?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">{label}</div>
      <div className={cn("text-sm sm:text-base font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
      {subValue && <div className="text-xs text-muted-foreground tabular-nums">{subValue}</div>}
    </div>
  );
}
