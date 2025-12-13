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
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4 shrink-0">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-mono font-bold tracking-tight uppercase">
            Market Structure
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
            Liquidity concentration and capital flow analysis. Visualizing order book depth and
            cross-sectional market correlations.
          </p>
        </div>
        <HeaderStats stats={heatmapStats} />
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

function HeaderStats({ stats }: { stats: any }) {
  if (!stats) return null;

  const items = [
    {
      label: "ASSETS",
      value: stats.totalAssets,
      sub: (
        <span className="text-[10px] text-muted-foreground ml-1">
          ({stats.gainers}/{stats.losers})
        </span>
      ),
    },
    { label: "MCAP", value: `$${formatCompact(stats.totalMcap)}` },
    {
      label: "AVG CHG",
      value: `${stats.avgChange >= 0 ? "+" : ""}${stats.avgChange.toFixed(2)}%`,
      className: stats.avgChange >= 0 ? "text-gain" : "text-loss",
    },
  ];

  return (
    <div className="flex items-center gap-4 sm:gap-6 text-xs shrink-0 self-start sm:self-center mt-2 sm:mt-1">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
            {item.label}
          </span>
          <div className="flex items-baseline">
            <span className={cn("font-semibold tabular-nums font-mono", item.className)}>
              {item.value}
            </span>
            {item.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
