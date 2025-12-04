/**
 * Asset Detail Page - Minimalist quant-focused design
 * Single unified signal card, clean layout, high signal density
 * Optimized: TradingChart lazy-loaded for better initial load
 */

import { useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@0xsignal/shared";
import { cachedAnalysis, cachedChartData } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { UnifiedSignalCard } from "../components/unified-signal-card";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";

// Lazy load the heavy TradingChart component (793 lines, 27KB)
const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart }))
);

// Skeleton fallback for lazy-loaded chart
const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center bg-card border border-border/50 rounded-lg">
    <Skeleton className="h-full w-full rounded-lg" />
  </div>
);

const fetchAssetData = (symbol: string) => cachedAnalysis(symbol);

const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

interface AssetContentProps {
  asset: AssetAnalysis;
  symbol: string;
  chartData: any[] | null;
  chartLoading: boolean;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

function AssetContent({
  asset,
  symbol,
  chartData,
  chartLoading,
  interval,
  onIntervalChange,
}: AssetContentProps) {
  const navigate = useNavigate();
  const chartSymbol = symbol.toUpperCase();

  const price = asset.price;
  const change24h = price?.change24h || 0;

  return (
    <div className="container-fluid h-full flex flex-col justify-center py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="flex items-center gap-3 mb-5 sm:mb-6 border-b border-border/40 pb-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate(-1)}
          className="sm:hidden -ml-2 touch-target-44"
          aria-label="Go back"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <CryptoIcon
            symbol={asset.symbol}
            image={asset.price?.image}
            size={32}
            className="shrink-0 sm:w-7 sm:h-7"
          />
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 flex-wrap min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-lg sm:text-xl font-mono font-bold tracking-tight">
                {asset.symbol.toUpperCase()}
              </span>
              <span className="text-lg sm:text-xl tabular-nums font-medium">
                ${formatPrice(price?.price || 0)}
              </span>
              <span
                className={cn(
                  "text-sm tabular-nums font-medium",
                  change24h > 0
                    ? "text-gain"
                    : change24h < 0
                      ? "text-loss"
                      : "text-muted-foreground"
                )}
              >
                {formatPercentChange(change24h)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              VOL ${formatCurrency(price?.volume24h || 0)}
              <span className="hidden lg:inline">
                {" · "}H ${formatPrice(price?.high24h || 0)}
                {" · "}L ${formatPrice(price?.low24h || 0)}
              </span>
            </span>
          </div>
        </div>
      </header>

      {/* Mobile: Signal first, Chart below */}
      {/* Large Screen: Side-by-side - Chart 80%, Signal 20% */}
      <div className="flex-1 min-h-0 flex flex-col xl:grid xl:grid-cols-5 gap-4 xl:gap-5">
        {/* Signal Card - First on mobile, right side on desktop */}
        <div className="xl:col-span-1 xl:order-2 xl:flex xl:items-start">
          <UnifiedSignalCard analysis={asset} className="w-full" />
        </div>

        {/* Chart Area - Height scales with device resolution */}
        <div className="xl:col-span-4 xl:order-1 flex-1 min-h-[300px] sm:min-h-[350px] lg:min-h-[450px] xl:min-h-[500px] 2xl:min-h-[600px]">
          {chartData && chartData.length > 0 ? (
            <Suspense fallback={<ChartSkeleton />}>
              <TradingChart
                data={chartData}
                symbol={chartSymbol}
                interval={interval}
                onIntervalChange={onIntervalChange}
              />
            </Suspense>
          ) : !chartLoading ? (
            <Card className="py-0 shadow-none h-full flex items-center justify-center border-dashed border-border/60">
              <CardContent className="text-center">
                <p className="text-sm text-muted-foreground font-mono">CHART DATA UNAVAILABLE</p>
              </CardContent>
            </Card>
          ) : (
            <Skeleton className="h-full w-full rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}

// Loading skeleton
function AssetDetailSkeleton({ symbol }: { symbol?: string }) {
  return (
    <div className="container-fluid py-3 sm:py-6 space-y-5 sm:space-y-6">
      <header className="flex items-center gap-3">
        <Skeleton className="w-7 h-7 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </header>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [interval, setInterval] = useState("1h");
  const chartSymbol = symbol?.toUpperCase() || "";
  const timeframe = INTERVAL_TIMEFRAMES[interval] || "7d";

  // Fetch asset data
  const {
    data: asset,
    isLoading: assetLoading,
    isError,
  } = useEffectQuery(() => fetchAssetData(symbol || ""), [symbol]);

  // Fetch chart data in parallel
  const { data: chartData, isLoading: chartLoading } = useEffectQuery(
    () => cachedChartData(chartSymbol, interval, timeframe),
    [chartSymbol, interval, timeframe]
  );

  if (assetLoading) {
    return <AssetDetailSkeleton symbol={symbol} />;
  }

  if (isError || !asset) {
    return (
      <div className="container-fluid py-6">
        <ErrorState
          title={isError ? "Unable to load asset data" : `No data for ${symbol?.toUpperCase()}`}
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <AssetContent
      asset={asset}
      symbol={symbol || ""}
      chartData={chartData}
      chartLoading={chartLoading}
      interval={interval}
      onIntervalChange={setInterval}
    />
  );
}
