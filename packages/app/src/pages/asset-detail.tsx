import { useState, useMemo, useCallback, useEffect, useLayoutEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { useAssetPrice } from "@/features/asset-detail/hooks/use-asset-price";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";
import { ErrorBoundary } from "@/components/error-boundary";
import { useMarketDataStore } from "@/stores/use-market-data-store";
import {
  AssetContent,
  type AssetViewModel,
} from "@/features/asset-detail/components/asset-content";
import { AssetDetailError, AssetDetailSkeleton } from "@/components/asset-detail-skeleton";

function nonZeroPrice(value: number | undefined): number | undefined {
  return value !== undefined && value !== 0 ? value : undefined;
}

export function AssetDetail() {
  const { symbol, base, quote } = useParams<{ symbol: string; base: string; quote: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  // rawCoin = exact Hyperliquid API identifier from URL.
  // Perp route /:symbol → rawCoin = symbol (e.g., "BTC", "xyz:TSLA")
  // Spot route /:base/:quote → rawCoin = "base/quote" (e.g., "PURR/USDC")
  const rawCoin = (quote !== undefined && quote !== "" ? `${base}/${quote}` : symbol) ?? "";

  const normalizedRoute = normalizeSymbol(rawCoin);
  useEffect(() => {
    if (rawCoin && rawCoin !== normalizedRoute) {
      const path = normalizedRoute;
      void navigate(`/trade/${path}`, { replace: true });
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
    void refetchAsset();
  }, [refetchAsset]);

  useEffect(() => {
    if (!assetError) return;
    toast.error(`Couldn't load ${symbol?.toUpperCase() ?? "this asset"}`, {
      description: "Check your connection and try again.",
    });
  }, [assetError, symbol]);

  const asset = useMemo<AssetViewModel | null>(
    () => (fetchedAsset ? { symbol: fetchedAsset.symbol, price: fetchedAsset } : null),
    [fetchedAsset],
  );

  // Only show full-page skeleton during initial asset fetch.
  // Widgets handle their own loading states independently.
  const showSkeleton = !asset && assetLoading;

  const documentTitle = useMemo(() => {
    const assetSymbol = asset?.symbol.toUpperCase() ?? "";
    const routeSymbol = symbol?.toUpperCase() ?? "";
    const fallbackPrice =
      nonZeroPrice(asset?.price?.price) ?? nonZeroPrice(asset?.price?.markPx) ?? 0;
    if (assetSymbol === "" && fallbackPrice === 0) return "";
    return formatPerpTitle(assetSymbol === "" ? routeSymbol : assetSymbol, fallbackPrice, 4);
  }, [asset, symbol]);

  useDocumentTitle({ title: documentTitle });

  if (showSkeleton) return <AssetDetailSkeleton />;

  if (assetError || (!fetchedAsset && !assetLoading)) {
    return (
      <AssetDetailError
        title={
          assetError
            ? `Couldn't load ${symbol?.toUpperCase() ?? "this asset"}. Check your connection and try again.`
            : `No data for ${symbol?.toUpperCase()}`
        }
        onRetry={handleRetry}
      />
    );
  }

  if (!asset) {
    return (
      <AssetDetailError title={`No data for ${symbol?.toUpperCase()}`} onRetry={handleRetry} />
    );
  }

  return (
    <>
      <h1 className="sr-only">{asset.symbol.toUpperCase()}</h1>
      <ErrorBoundary resetKey={pathname}>
        <AssetContent
          asset={asset}
          symbol={rawCoin}
          interval={interval}
          onIntervalChange={handleIntervalChange}
          showChartSkeleton={false}
        />
      </ErrorBoundary>
    </>
  );
}
