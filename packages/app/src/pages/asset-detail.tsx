/**
 * @overview Asset Detail Page (Trade View)
 *
 * Data flow:
 * 1. URL params → symbol (from /trade/:symbol route)
 * 2. React Query → asset metadata (price, volume, leverage)
 * 3. useHyperliquidCandles → real-time candlestick data (WS + history)
 * 4. CandleDataProvider → shares candle data via ref to avoid memo invalidation
 * 5. useHyperliquidMeta → price precision from exchange
 * 6. L2BookNSigFigsProvider → syncs orderbook + depth chart precision
 * 7. Renders: TradingChart (4/5 cols) + OrderbookWidget (1/5 col, lg+)
 *
 * @performance
 * - CandleDataProvider exposes dataRef instead of data array to prevent
 *   memo invalidation on TradingChart/AssetContent from new array references
 * - Chart consumes candles from context internally, not via props
 * - State: interval is local (user's timeframe choice)
 */
import { useState, lazy, Suspense, useMemo, memo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { AssetAnalysis } from "@/core/types";
import { ChartCandlestick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { useChartConfig } from "@/hooks/use-breakpoint";
import { queryKeys } from "@/lib/query/query-keys";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";
import { OrderbookWidget } from "@/features/trade/components/orderbook-widget";
import { L2BookNSigFigsProvider } from "@/features/trade/contexts/l2-book-nsig-figs-context";
import { CandleDataProvider } from "@/features/trade/contexts/candle-data-context";
import { useTradeAnnotation } from "@/features/trade/hooks/use-trade-annotation";

const TradingChart = lazy(() =>
  import("@/features/chart/trading-chart").then((m) => ({ default: m.TradingChart }))
);

const TradeDropdown = lazy(() =>
  import("@/features/trade/components/trade-dropdown").then((m) => ({ default: m.TradeDropdown }))
);

import { formatPrice } from "@/core/utils/formatters";

const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center bg-card/50 rounded-xl">
    <Skeleton className="h-full w-full rounded-xl" />
  </div>
);

interface AssetContentProps {
  readonly asset: AssetAnalysis & { fetchedAt?: Date };
  readonly symbol: string;
  readonly interval: string;
  readonly onIntervalChange: (interval: string) => void;
  readonly chartLoading: boolean;
}

const AssetContent = memo(function AssetContent({
  asset,
  symbol,
  interval,
  onIntervalChange,
  chartLoading,
}: AssetContentProps) {
  const navigate = useNavigate();
  const chartSymbol = symbol.toUpperCase();
  const price = asset.price;

  const { data: annotation } = useTradeAnnotation(symbol);
  const displayName = annotation?.displayName || asset.symbol.toUpperCase();
  const description = annotation?.description;

  return (
    <div className="container-fluid h-full flex flex-col py-3 sm:py-4 animate-in fade-in slide-in-from-bottom-1 duration-300 ease-premium overflow-y-auto lg:overflow-hidden overscroll-none select-none">
      {/* Header */}
      <header className="mb-4 sm:mb-5 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <TradeDropdown currentSymbol={displayName} />
          <span className="text-lg sm:text-xl font-mono font-semibold tabular-nums">
            {formatPrice(price?.price || 0)}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => navigate(`/trade/${symbol}/orderbook`)}
            className="lg:hidden shrink-0 border ml-auto"
            aria-label="Orderbook"
          >
            <ChartCandlestick className="w-5 h-5" />
          </Button>
        </div>
        {description && (
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-2xl">
            {description}
          </p>
        )}
      </header>

      {/* Shared L2 nSigFigs so Orderbook dropdown and Depth chart use the same Hyperliquid aggregation */}
      <L2BookNSigFigsProvider key={symbol}>
        {/* Main Content: Chart + Side Panel */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-5 gap-4 lg:gap-5">
          {/* Chart - Takes 4/5 on desktop */}
          <div className="lg:col-span-4 flex-1 min-h-[350px] lg:min-h-0 lg:h-full min-h-0 flex flex-col">
            {chartLoading ? (
              <Skeleton className="h-full w-full rounded-sm" />
            ) : (
              <Suspense fallback={<ChartSkeleton />}>
                <TradingChart
                  symbol={chartSymbol}
                  interval={interval}
                  onIntervalChange={onIntervalChange}
                />
              </Suspense>
            )}
          </div>

          {/* Side Panel: Orderbook - Only visible on lg+ */}
          <div className="hidden lg:block lg:col-span-1 min-h-[400px] lg:min-h-0 lg:h-full flex flex-col">
            <OrderbookWidget key={symbol} symbol={symbol} />
          </div>
        </div>
      </L2BookNSigFigsProvider>
    </div>
  );
});

function AssetDetailSkeleton() {
  return (
    <div className="container-fluid h-full overflow-y-auto py-3 sm:py-6 space-y-5 sm:space-y-6 overscroll-none">
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

  const handleIntervalChange = useCallback((newInterval: string) => {
    setInterval(newInterval);
  }, []);

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  const normalizedSymbol = symbol?.toUpperCase() || "";
  const chartSymbol = normalizedSymbol.endsWith("USDT")
    ? normalizedSymbol
    : `${normalizedSymbol}USDT`;

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

  const asset: AssetAnalysis | null = useMemo(() => {
    if (!fetchedAsset) return null;
    return {
      symbol: fetchedAsset.symbol,
      overallSignal: "HOLD",
      confidence: 50,
      riskScore: 50,
      price: {
        symbol: fetchedAsset.symbol,
        price: fetchedAsset.price,
        change1h: 0,
        change24h: fetchedAsset.change24h,
        change7d: 0,
        sparkline7d: [],
        volume24h: fetchedAsset.volume24h,
        high24h: fetchedAsset.high24h,
        low24h: fetchedAsset.low24h,
        marketCap: 0,
        timestamp: fetchedAsset.timestamp,
      },
      entrySignal: null,
    };
  }, [fetchedAsset]);

  const {
    data: candleData,
    dataRef: candleDataRef,
    isLoading: chartLoading,
    loadMore: loadMoreCandles,
    hasMore: hasMoreCandles,
    isFetching: chartFetching,
  } = useHyperliquidCandles({
    symbol: chartSymbol,
    interval,
    limit: chartConfig.initialCandles,
    enabled: !!chartSymbol,
  });

  const { getPrecision } = useHyperliquidMeta();

  // Use data (state) instead of dataRef for render-phase access
  const latestPrice = useMemo(() => {
    if (!candleData || candleData.length === 0) return null;
    return candleData[candleData.length - 1].close;
  }, [candleData]);

  const showSkeleton = !asset && assetLoading;

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

  if (showSkeleton) return <AssetDetailSkeleton />;

  if (assetError || (!fetchedAsset && !assetLoading)) {
    return (
      <div className="container-fluid h-full overflow-y-auto py-6 overscroll-none">
        <ErrorState
          title={
            assetError ? `Error: ${assetError.message}` : `No data for ${symbol?.toUpperCase()}`
          }
          retryAction={handleRetry}
        />
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="container-fluid h-full overflow-y-auto py-6 overscroll-none">
        <ErrorState title={`No data for ${symbol?.toUpperCase()}`} retryAction={handleRetry} />
      </div>
    );
  }

  return (
    <CandleDataProvider
      data={candleData}
      dataRef={candleDataRef}
      isLoading={chartLoading}
      loadMore={loadMoreCandles}
      hasMore={hasMoreCandles}
      isFetching={chartFetching}
    >
      <AssetContent
        asset={asset}
        symbol={symbol || ""}
        interval={interval}
        onIntervalChange={handleIntervalChange}
        chartLoading={chartLoading}
      />
    </CandleDataProvider>
  );
}
