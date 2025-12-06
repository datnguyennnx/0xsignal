import { useState, useMemo, useEffect } from "react";
import { cachedHeatmap, cachedLiquidationHeatmap } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { MarketHeatmapComponent } from "../components/market-heatmap";
import { LiquidationHeatmapComponent } from "../components/liquidation-heatmap";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useResponsiveDataCount } from "@/core/hooks/use-responsive-data-count";
import { formatCompact } from "@/core/utils/formatters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SM_BREAKPOINT = 640;

export function MarketDepthPage() {
  const [activeTab, setActiveTab] = useState<"heatmap" | "liquidation">("heatmap");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("btc");
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
  const { data: liquidationData, isLoading: isLiquidationLoading } = useEffectQuery(
    () => cachedLiquidationHeatmap(selectedSymbol),
    [selectedSymbol, activeTab === "liquidation"]
  );

  const availableSymbols = heatmapData?.cells
    ? heatmapData.cells.slice(0, dataLimit).map((cell) => cell.symbol.toLowerCase())
    : [];

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

  const liquidationStats = useMemo(() => {
    if (!liquidationData?.levels?.length) return null;
    const levels = liquidationData.levels;
    const totalLong = levels.reduce((sum, l) => sum + l.longLiquidationUsd, 0);
    const totalShort = levels.reduce((sum, l) => sum + l.shortLiquidationUsd, 0);
    const total = totalLong + totalShort;
    const longPercent = total > 0 ? (totalLong / total) * 100 : 0;
    return {
      totalLong,
      totalShort,
      total,
      longPercent,
      currentPrice: liquidationData.currentPrice,
    };
  }, [liquidationData]);

  return (
    <div className="h-full flex flex-col container-fluid py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-3 sm:mb-4 shrink-0 border-b border-border/40 pb-3 sm:pb-4">
        <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight uppercase">
          Market Depth
        </h1>
        <div className="flex items-center gap-1 bg-secondary/20 p-1 rounded-sm self-start sm:self-auto">
          <Button
            variant={activeTab === "heatmap" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("heatmap")}
            className={cn(
              "h-7 text-xs font-mono rounded-sm transition-all",
              activeTab === "heatmap" ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            HEATMAP
          </Button>
          <Button
            variant={activeTab === "liquidation" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("liquidation")}
            className={cn(
              "h-7 text-xs font-mono rounded-sm transition-all gap-1.5",
              activeTab === "liquidation" ? "bg-background shadow-sm" : "hover:bg-background/50"
            )}
          >
            LIQUIDATIONS
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-[8px] h-4 px-1 border-orange-500/40 text-orange-500"
                >
                  EST
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-semibold mb-1">Estimated Data</p>
                <p>
                  Calculated from Open Interest and volatility. Not actual exchange liquidation
                  tape.
                </p>
              </TooltipContent>
            </Tooltip>
          </Button>
        </div>
      </div>

      <div className="mb-4">
        {activeTab === "heatmap" ? (
          <HeatmapStats stats={heatmapStats} />
        ) : (
          <LiquidationStats
            stats={liquidationStats}
            selectedSymbol={selectedSymbol}
            availableSymbols={availableSymbols}
            onSymbolChange={setSelectedSymbol}
          />
        )}
      </div>

      <div className="flex-1 min-h-[300px] sm:min-h-0 border border-border/50 bg-card/30 rounded-sm overflow-hidden relative">
        {activeTab === "heatmap" ? (
          isLoading ? (
            <Skeleton className="h-full w-full rounded-none" />
          ) : (
            <MarketHeatmapComponent data={heatmapData!} isLoading={isLoading} />
          )
        ) : isLiquidationLoading ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <LiquidationHeatmapComponent data={liquidationData!} isLoading={isLiquidationLoading} />
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

function LiquidationStats({
  stats,
  selectedSymbol,
  availableSymbols,
  onSymbolChange,
}: {
  stats: any;
  selectedSymbol: string;
  availableSymbols: string[];
  onSymbolChange: (s: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 sm:gap-6 shrink-0">
      <div>
        <div className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">
          Symbol
        </div>
        <Select value={selectedSymbol} onValueChange={onSymbolChange}>
          <SelectTrigger size="sm" className="h-8 text-sm font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableSymbols.map((symbol) => (
              <SelectItem key={symbol} value={symbol} className="font-mono text-xs">
                {symbol.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {stats && (
        <>
          <StatItem label="Price" value={`$${stats.currentPrice?.toLocaleString()}`} />
          <StatItem label="Total" value={`$${formatCompact(stats.total)}`} />
          <StatItem
            label="Longs"
            value={`$${formatCompact(stats.totalLong)}`}
            subValue={`${stats.longPercent.toFixed(0)}%`}
            valueClass="text-loss"
          />
          <StatItem
            label="Shorts"
            value={`$${formatCompact(stats.totalShort)}`}
            subValue={`${(100 - stats.longPercent).toFixed(0)}%`}
            valueClass="text-gain"
          />
        </>
      )}
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
