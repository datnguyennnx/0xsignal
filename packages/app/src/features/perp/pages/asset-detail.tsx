/**
 * @fileoverview Asset Detail Page
 *
 * Main perpetual trading page with chart, orderbook, and analysis.
 *
 * @data-flow
 * 1. URL params -> symbol, interval
 * 2. Fetch asset data (price, volume, etc.)
 * 3. Fetch candlestick data (historical + real-time)
 * 4. Render chart with TradingChart component
 *
 * @performance
 * - Lazy loads TradingChart (heavy)
 * - Prefetches on hover from dashboard
 * - Uses React Query with optimized stale times
 * - Memoizes derived values
 */
import { useState, lazy, Suspense, useMemo, memo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@/core/types";
import type { ChartDataPoint } from "@0xsignal/shared";
import { getHydratedAnalysis } from "@/core/cache/analysis-store";
import { cn } from "@/core/utils/cn";
import { formatPrice, formatCurrency, formatPercentChange } from "@/core/utils/formatters";
import { ChevronLeft, ChartCandlestick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api, type FuturesPrice } from "@/services/api";
import { useHyperliquidCandles } from "@/hooks/use-hyperliquid-candles";
import { useHyperliquidMeta } from "@/hooks/use-hyperliquid-meta";
import { useChartConfig } from "@/hooks/use-breakpoint";
import { queryKeys } from "@/lib/query/query-keys";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";

import { OrderbookWidget } from "@/features/perp/components/orderbook-widget";
import { PerpDropdown } from "@/features/perp/components/perp-dropdown";

const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart }))
);

const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center bg-card border border-border/50 rounded-lg">
    <Skeleton className="h-full w-full rounded-lg" />
  </div>
);

const INTERVAL_TIMEFRAMES: Record<string, string> = {
  "15m": "24h",
  "1h": "7d",
  "4h": "1M",
  "1d": "1M",
  "1w": "1y",
};

interface AssetContentProps {
  readonly asset: AssetAnalysis & { fetchedAt?: Date };
  readonly symbol: string;
  readonly chartData: ChartDataPoint[] | null;
  readonly chartLoading: boolean;
  readonly chartFetching: boolean;
  readonly interval: string;
  readonly onIntervalChange: (interval: string) => void;
  readonly loadMore?: () => Promise<void>;
  readonly hasMore?: boolean;
}

const AssetContent = memo(function AssetContent({
  asset,
  symbol,
  chartData,
  chartLoading,
  chartFetching,
  interval,
  onIntervalChange,
  loadMore,
  hasMore,
}: AssetContentProps) {
  const navigate = useNavigate();
  const chartSymbol = symbol.toUpperCase();
  const price = asset.price;
  const change24h = price?.change24h || 0;

  return (
    <div className="container-fluid h-full flex flex-col py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-premium overflow-y-auto lg:overflow-hidden">
      {/* Header */}
      <header className="mb-4 sm:mb-5 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <PerpDropdown currentSymbol={asset.symbol.toUpperCase()} />
          <div className="flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-lg sm:text-xl tabular-nums font-medium">
              ${formatPrice(price?.price || 0)}
            </span>
            <span
              className={cn(
                "text-xs sm:text-sm tabular-nums font-medium",
                change24h > 0 ? "text-gain" : change24h < 0 ? "text-loss" : "text-muted-foreground"
              )}
            >
              {formatPercentChange(change24h)}
            </span>
            <span className="text-xs text-muted-foreground font-mono hidden sm:inline">
              VOL {formatCurrency(price?.volume24h || 0)}
            </span>
            <span className="text-xs text-muted-foreground font-mono hidden lg:inline">
              H ${formatPrice(price?.high24h || 0)}
            </span>
            <span className="text-xs text-muted-foreground font-mono hidden lg:inline">
              L ${formatPrice(price?.low24h || 0)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(`/perp/${symbol}/orderbook`)}
            className="lg:hidden shrink-0 border ml-auto"
            aria-label="Orderbook"
          >
            <ChartCandlestick className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Main Content: Chart + Side Panel */}
      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-5 gap-4 lg:gap-5">
        {/* Chart - Takes 4/5 on desktop */}
        <div className="lg:col-span-4 flex-1 min-h-[350px] lg:min-h-0 lg:h-full flex flex-col">
          {chartData && chartData.length > 0 ? (
            <Suspense fallback={<ChartSkeleton />}>
              {/*
                @note No key prop - chart handles data updates naturally
                When interval changes:
                1. useHyperliquidCandles fetches new data
                2. New data flows to TradingChart via props
                3. useChartData effect detects data change, clears old data, loads new
                This is SMOOTHER than remounting because chart instance is preserved
              */}
              <TradingChart
                data={chartData}
                symbol={chartSymbol}
                interval={interval}
                onIntervalChange={onIntervalChange}
                loadMore={loadMore}
                hasMore={hasMore}
                isFetching={chartFetching}
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

        {/* Side Panel: Orderbook - Only visible on lg+ */}
        <div className="hidden lg:block lg:col-span-1 min-h-[400px] lg:min-h-0 lg:h-full flex flex-col">
          <OrderbookWidget symbol={symbol} />
        </div>
      </div>
    </div>
  );
});

function AssetDetailSkeleton({ symbol }: { readonly symbol?: string }) {
  return (
    <div className="container-fluid h-full overflow-y-auto py-3 sm:py-6 space-y-5 sm:space-y-6">
      <header className="flex items-center gap-3">
        <Skeleton className="w-7 h-7 rounded-full" />
        <div>
          <Skeleton className="h-6 w-32 mb-1" />
          <Skeleton className="h-4 w-48" />
        </div>
      </header>
      <div className="grid lg:grid-cols-5 gap-4 lg:gap-5">
        <Skeleton className="lg:col-span-4 h-80 lg:h-[500px] rounded-xl" />
        <Skeleton className="lg:col-span-1 h-80 lg:h-[500px] rounded-xl" />
      </div>
    </div>
  );
}

export function AssetDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [interval, setInterval] = useState("1h");
  const chartConfig = useChartConfig();

  // Stable callback - prevents re-render of child components
  const handleIntervalChange = useCallback((newInterval: string) => {
    setInterval(newInterval);
  }, []);

  const normalizedSymbol = symbol?.toUpperCase() || "";
  const chartSymbol = normalizedSymbol.endsWith("USDT")
    ? normalizedSymbol
    : `${normalizedSymbol}USDT`;
  const timeframe = INTERVAL_TIMEFRAMES[interval] || "7d";

  const hydratedData = useMemo(() => (symbol ? getHydratedAnalysis(symbol) : null), [symbol]);

  // Fetch asset data với React Query - using Hyperliquid directly
  const {
    data: fetchedAsset,
    isLoading: assetLoading,
    error: assetError,
  } = useQuery({
    queryKey: queryKeys.asset.bySymbol(symbol || ""),
    queryFn: () => api.getFuturesPrice(symbol || ""),
    enabled: !!symbol,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    retry: 1,
  });

  // Tạo mock AssetAnalysis từ price data
  const asset: AssetAnalysis | null = useMemo(() => {
    if (hydratedData) return hydratedData;
    if (!fetchedAsset) return null;
    return {
      symbol: fetchedAsset.symbol,
      overallSignal: "HOLD",
      confidence: 50,
      riskScore: 50,
      price: {
        symbol: fetchedAsset.symbol,
        price: fetchedAsset.price,
        change24h: fetchedAsset.change24h,
        volume24h: fetchedAsset.volume24h,
        high24h: fetchedAsset.high24h,
        low24h: fetchedAsset.low24h,
        marketCap: 0,
        timestamp: fetchedAsset.timestamp,
      },
      entrySignal: null,
    };
  }, [fetchedAsset, hydratedData]);

  // Get real-time price from latest candle for title
  // Fetch chart data using Hyperliquid streaming hook with device-aware limits
  const {
    data: chartData,
    isLoading: chartLoading,
    loadMore: loadMoreCandles,
    hasMore: hasMoreCandles,
  } = useHyperliquidCandles({
    symbol: chartSymbol,
    interval,
    limit: chartConfig.initialCandles,
    enabled: !!chartSymbol,
  });

  const chartFetching = chartLoading;

  // Get precision from hyperliquid meta
  const { getPrecision } = useHyperliquidMeta();

  // Get real-time price from latest candle for title
  const latestPrice = useMemo(() => {
    if (!chartData || chartData.length === 0) return null;
    return chartData[chartData.length - 1].close;
  }, [chartData]);

  const showSkeleton = !asset && assetLoading;

  // Dynamic document title - Real-time price from chart
  const documentTitle = useMemo(() => {
    if (!asset?.price && !latestPrice) return "";
    const price = latestPrice || asset?.price?.price || 0;
    const precision = getPrecision(symbol || "").pxDecimals;
    return formatPerpTitle(
      asset?.symbol.toUpperCase() || symbol?.toUpperCase() || "",
      price,
      precision
    );
  }, [asset, symbol, latestPrice, getPrecision]);

  useDocumentTitle({ title: documentTitle });

  if (showSkeleton) return <AssetDetailSkeleton symbol={symbol} />;

  if (assetError || (!fetchedAsset && !assetLoading)) {
    return (
      <div className="container-fluid h-full overflow-y-auto py-6">
        <ErrorState
          title={
            assetError ? `Error: ${assetError.message}` : `No data for ${symbol?.toUpperCase()}`
          }
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <AssetContent
      asset={asset!}
      symbol={symbol || ""}
      chartData={(chartData as ChartDataPoint[]) || null}
      chartLoading={chartLoading}
      chartFetching={chartFetching}
      interval={interval}
      onIntervalChange={handleIntervalChange}
      loadMore={loadMoreCandles}
      hasMore={hasMoreCandles}
    />
  );
}
