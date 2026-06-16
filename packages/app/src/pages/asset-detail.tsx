import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { queryKeys } from "@/lib/query/query-keys";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";
import { ErrorBoundary } from "@/components/error-boundary";
import { CandleDataProvider } from "@/features/trade/contexts/candle-data-context";
import { useIsDesktop } from "@/hooks/use-breakpoint";
import {
  AssetContent,
  type AssetViewModel,
} from "@/features/asset-detail/components/asset-content";

const DESKTOP_CONFIG = {
  initialCandles: 350,
  loadMoreCandles: 300,
  visibleCandles: 250,
};

function AssetDetailSkeleton() {
  const isDesktop = useIsDesktop();
  return (
    <div className="container-fluid flex-1 min-h-0 flex flex-col pt-3 pb-3 px-4 select-none overflow-hidden gap-[clamp(0.75rem,1.25vw,1.25rem)] animate-in fade-in duration-200 ease-premium">
      <header className="flex items-center gap-3 shrink-0">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </header>
      <div className="flex-1 min-h-0 flex flex-col gap-1">
        {isDesktop ? (
          <>
            <div className="flex-[6] min-h-0 grid grid-cols-6 gap-1">
              <Skeleton className="col-span-4 rounded-lg" />
              <Skeleton className="col-span-1 rounded-lg" />
              <Skeleton className="col-span-1 rounded-lg" />
            </div>
            <div className="flex-[4] min-h-0">
              <Skeleton className="h-full w-full rounded-lg bg-muted/50" />
            </div>
          </>
        ) : (
          <>
            {/* Narrow skeleton: grid structure matching AssetContent */}
            <div className="flex-1 min-h-0 grid grid-cols-[1fr_30%] grid-rows-[1fr_minmax(0,1fr)] gap-1">
              <Skeleton className="min-h-0 rounded-lg" />
              <Skeleton className="min-h-0 rounded-lg" />
              <Skeleton className="min-h-0 rounded-lg" />
              <Skeleton className="min-h-0 rounded-lg" />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AssetDetail() {
  const { symbol, base, quote } = useParams<{ symbol: string; base: string; quote: string }>();
  const navigate = useNavigate();
  // rawCoin = exact Hyperliquid API identifier from URL.
  // Perp route /:symbol → rawCoin = symbol (e.g., "BTC", "xyz:TSLA")
  // Spot route /:base/:quote → rawCoin = "base/quote" (e.g., "PURR/USDC")
  const rawCoin = (quote ? `${base}/${quote}` : symbol) ?? "";

  // Redirect lowercase URLs (/trade/btc → /trade/BTC)
  const normalizedRoute = normalizeSymbol(rawCoin);
  useEffect(() => {
    if (rawCoin && rawCoin !== normalizedRoute) {
      const path = normalizedRoute;
      navigate(`/trade/${path}`, { replace: true });
    }
  }, [rawCoin, normalizedRoute, navigate]);

  const [interval, setInterval] = useState("1h");

  const handleIntervalChange = useCallback((newInterval: string) => {
    setInterval(newInterval);
  }, []);

  const normalizedSymbol = rawCoin.toUpperCase();
  // Perps use {COIN}USDT for TradingView mapping; spots use the raw pair name.
  const isSpotUrl = rawCoin.includes("/");
  const chartSymbol = isSpotUrl
    ? rawCoin
    : normalizedSymbol.endsWith("USDT")
      ? normalizedSymbol
      : `${normalizedSymbol}USDT`;

  // WS enabled by default — backend validates perp-only server-side (rejects spot).
  // Markets list is loaded lazily (trade dropdown intent), not needed for above-the-fold render.
  const enableWsRealtime = true;

  const {
    data: fetchedAsset,
    isLoading: assetLoading,
    error: assetError,
    refetch: refetchAsset,
  } = useQuery({
    queryKey: queryKeys.asset.bySymbol(rawCoin),
    queryFn: () => api.getMarketPrice(rawCoin),
    enabled: !!rawCoin,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    retry: 1,
    // Show previous price data while loading next symbol
    placeholderData: (prev) => prev,
  });

  const handleRetry = useCallback(() => {
    refetchAsset();
  }, [refetchAsset]);

  const asset = useMemo<AssetViewModel | null>(
    () => (fetchedAsset ? { symbol: fetchedAsset.symbol, price: fetchedAsset } : null),
    [fetchedAsset]
  );

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
    limit: DESKTOP_CONFIG.initialCandles,
    enabled: enableWsRealtime,
  });

  const latestPrice = useMemo(() => {
    if (!candleData || candleData.length === 0) return null;
    return candleData[candleData.length - 1].close;
  }, [candleData]);

  // Only show full-page skeleton during initial asset fetch.
  // Widgets handle their own loading states independently.
  const showSkeleton = !asset && assetLoading;
  const showChartSkeleton = chartLoading;

  const documentTitle = useMemo(() => {
    if (!asset?.price && !latestPrice) return "";
    const price = latestPrice || asset?.price?.price || 0;
    // Use default precision (4) — markets list is lazy-loaded, precision cosmetics are non-critical
    return formatPerpTitle(asset?.symbol.toUpperCase() || symbol?.toUpperCase() || "", price, 4);
  }, [asset, symbol, latestPrice]);

  useDocumentTitle({ title: documentTitle });

  if (showSkeleton) return <AssetDetailSkeleton />;

  if (assetError || (!fetchedAsset && !assetLoading)) {
    return (
      <div className="container-fluid h-full py-6 overscroll-none animate-in fade-in duration-200 ease-premium">
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
      <div className="container-fluid h-full py-6 overscroll-none animate-in fade-in duration-200 ease-premium">
        <ErrorState title={`No data for ${symbol?.toUpperCase()}`} retryAction={handleRetry} />
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
          symbol={rawCoin}
          interval={interval}
          onIntervalChange={handleIntervalChange}
          showChartSkeleton={showChartSkeleton}
        />
      </CandleDataProvider>
    </ErrorBoundary>
  );
}
