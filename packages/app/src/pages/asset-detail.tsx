import { useState, useMemo, useCallback, useEffect, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useAssetPrice } from "@/features/asset-detail/hooks/use-asset-price";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";
import { ErrorBoundary } from "@/components/error-boundary";
import { useIsDesktop } from "@/hooks/use-breakpoint";
import { useMarketDataStore } from "@/stores/use-market-data-store";
import {
  AssetContent,
  type AssetViewModel,
} from "@/features/asset-detail/components/asset-content";

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

  const normalizedRoute = normalizeSymbol(rawCoin);
  useEffect(() => {
    if (rawCoin && rawCoin !== normalizedRoute) {
      const path = normalizedRoute;
      navigate(`/trade/${path}`, { replace: true });
    }
  }, [rawCoin, normalizedRoute, navigate]);

  // Lazy-init market stream client synchronously before paint so child
  // components (AssetContent → useAllMids → useHyperliquidWs) find the
  // client available on first painted render.
  // Idempotent — initializeStreamClient returns existing client if already
  // created, only calls Zustand set() once.
  useLayoutEffect(() => {
    useMarketDataStore.getState().initializeStreamClient();
  }, []);

  const [interval, setInterval] = useState("1h");

  const handleIntervalChange = useCallback((newInterval: string) => {
    setInterval(newInterval);
  }, []);

  const {
    data: fetchedAsset,
    isLoading: assetLoading,
    error: assetError,
    refetch: refetchAsset,
  } = useAssetPrice(rawCoin);

  const handleRetry = useCallback(() => {
    refetchAsset();
  }, [refetchAsset]);

  const asset = useMemo<AssetViewModel | null>(
    () => (fetchedAsset ? { symbol: fetchedAsset.symbol, price: fetchedAsset } : null),
    [fetchedAsset],
  );

  // Only show full-page skeleton during initial asset fetch.
  // Widgets handle their own loading states independently.
  const showSkeleton = !asset && assetLoading;

  const documentTitle = useMemo(() => {
    const fallbackPrice = asset?.price?.price || asset?.price?.markPx || 0;
    if (!asset?.symbol && !fallbackPrice) return "";
    return formatPerpTitle(
      asset?.symbol.toUpperCase() || symbol?.toUpperCase() || "",
      fallbackPrice,
      4,
    );
  }, [asset, symbol]);

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
      <AssetContent
        asset={asset}
        symbol={rawCoin}
        interval={interval}
        onIntervalChange={handleIntervalChange}
        showChartSkeleton={false}
      />
    </ErrorBoundary>
  );
}
