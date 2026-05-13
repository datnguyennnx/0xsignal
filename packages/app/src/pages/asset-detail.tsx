/**
 * @overview Asset Detail Page (Trade View)
 * Data flow:
 * 1. URL params → symbol (from /trade/:symbol route)
 * 2. React Query → asset metadata (price, volume, leverage)
 * 3. useHyperliquidCandles → real-time candlestick data (WS + history)
 * 4. CandleDataProvider → shares candle data via ref to avoid memo invalidation
 * 5. useHyperliquidMeta → price precision from exchange
 * 6. L2BookNSigFigsProvider → syncs orderbook + depth chart precision
 * 7. Renders: TradingChart (5/6 cols) + OrderbookWidget (1/6 col)
 */
import { useState, lazy, Suspense, useMemo, memo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api, type MarketPrice } from "@/services/api";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { queryKeys } from "@/lib/query/query-keys";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";
import { OrderbookWidget } from "@/features/trade/components/orderbook-widget";
import { ErrorBoundary } from "@/components/error-boundary";
import { PositionManagement } from "@/features/trade/components/position-management";
import { OrderForm } from "@/features/trade/components/order-form";
import { L2BookNSigFigsProvider } from "@/features/trade/contexts/l2-book-nsig-figs-context";
import { CandleDataProvider } from "@/features/trade/contexts/candle-data-context";
import { useTradeAnnotation } from "@/features/trade/hooks/use-trade-annotation";
import { useHyperliquidSymbolLogo } from "@/features/trade/hooks/use-hyperliquid-symbol-logo";

const TradingChart = lazy(() =>
  import("@/features/chart/trading-chart").then((m) => ({ default: m.TradingChart }))
);

const TradeDropdown = lazy(() =>
  import("@/features/trade/components/trade-dropdown").then((m) => ({ default: m.TradeDropdown }))
);

import { cn } from "@/core/utils/cn";
import {
  formatSignedUsd,
  formatFundingPercent,
  toCountdown,
  getNextFundingMs,
} from "./asset-detail.utils";
import { formatCompactUsd, formatPrice, formatSignedPercent } from "@/core/utils/formatters";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";
import { useAllMids } from "@/features/trade/hooks/use-all-mids";

const DESKTOP_CONFIG = {
  initialCandles: 350,
  loadMoreCandles: 300,
  visibleCandles: 250,
};

const MetricItem = memo(function MetricItem({
  label,
  value,
  tone = "neutral",
  hideable,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "negative";
  hideable?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", hideable && "hidden lg:block")}>
      <span className="text-[10px] tracking-wider text-muted-foreground/60 font-medium uppercase leading-none mb-1">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums leading-none whitespace-nowrap",
          tone === "positive" && "text-gain",
          tone === "negative" && "text-loss",
          tone === "neutral" && "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
});

const MarketTerminalHeader = memo(function MarketTerminalHeader({
  markPrice,
  oraclePrice,
  change24hAbs,
  change24hPct,
  volume24h,
  openInterest,
  fundingRate,
  fundingCountdown,
}: {
  markPrice: number;
  oraclePrice: number;
  change24hAbs: number;
  change24hPct: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  fundingCountdown: string;
}) {
  const changeTone = change24hPct >= 0 ? "positive" : "negative";
  const fundingTone = fundingRate >= 0 ? "positive" : "negative";

  return (
    <div className="flex items-center gap-6 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
      <MetricItem label="Mark" value={formatPrice(markPrice)} />
      <MetricItem label="Oracle" value={formatPrice(oraclePrice)} />
      <MetricItem
        label="24h Change"
        value={`${formatSignedUsd(change24hAbs)} / ${formatSignedPercent(change24hPct)}`}
        tone={changeTone}
      />
      <MetricItem label="24h Volume" value={formatCompactUsd(volume24h)} />
      <MetricItem label="Open Interest" value={formatCompactUsd(openInterest)} />
      <div className="flex flex-col shrink-0">
        <span className="text-[10px] tracking-wider text-muted-foreground/60 font-medium uppercase leading-none mb-1">
          Funding / Countdown
        </span>
        <div className="flex items-baseline gap-1 text-sm leading-none">
          <span
            className={cn(
              "font-semibold tabular-nums",
              fundingTone === "positive" && "text-gain",
              fundingTone === "negative" && "text-loss"
            )}
          >
            {formatFundingPercent(fundingRate)}
          </span>
          <span className="text-muted-foreground/50 font-normal">/</span>
          <span className="text-muted-foreground/70 font-mono tabular-nums">
            {fundingCountdown}
          </span>
        </div>
      </div>
    </div>
  );
});

const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center bg-card/50 rounded-xl">
    <Skeleton className="h-full w-full rounded-xl" />
  </div>
);

interface AssetViewModel {
  readonly symbol: string;
  readonly price: MarketPrice;
}

interface AssetContentProps {
  readonly asset: AssetViewModel;
  readonly symbol: string;
  readonly interval: string;
  readonly onIntervalChange: (interval: string) => void;
  readonly showChartSkeleton: boolean;
}

const AssetContent = memo(function AssetContent({
  asset,
  symbol,
  interval,
  onIntervalChange,
  showChartSkeleton,
}: AssetContentProps) {
  const chartSymbol = symbol.toUpperCase();
  const price = asset.price;
  const [fundingCountdown, setFundingCountdown] = useState(() => toCountdown(getNextFundingMs()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setFundingCountdown(toCountdown(getNextFundingMs()));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // `symbol` is the rawCoin from URL (perp: "BTC", spot: "PURR/USDC", HIP-3: "xyz:TSLA")
  const { data: annotation } = useTradeAnnotation(symbol);
  const { data: logoUrl } = useHyperliquidSymbolLogo(symbol);
  const { data: tradeList } = useTradeList();
  const displayName = annotation?.displayName || symbol.toUpperCase();
  const description = annotation?.description;

  // Resolve trade asset from aggregated list by matching rawCoin (case-insensitive)
  const tradeAsset = useMemo(() => {
    if (!tradeList?.assets) return undefined;
    return tradeList.assets.find((a) => a.rawCoin.toLowerCase() === symbol.toLowerCase());
  }, [tradeList, symbol]);
  const displaySymbol = tradeAsset?.displaySymbol;
  const isHip3 = tradeAsset?.isHip3 ?? false;
  const dexPrefix = tradeAsset?.dexPrefix;

  // Real-time mark price from WebSocket (allMids channel)
  const allMids = useAllMids(!!symbol);
  const liveMarkPrice = useMemo(() => {
    // 1. WebSocket allMids real-time stream (handles perp "xyz:TSLA" and spot "PURR/USDC")
    if (allMids[symbol]) return Number(allMids[symbol]);
    // Fall back to normalized uppercase for backward compat
    const upper = symbol.toUpperCase();
    if (allMids[upper]) return Number(allMids[upper]);
    // 2. Aggregated markets list — spot prices from spotMetaAndAssetCtxs
    //    This is the authoritative source for spot mark prices when WebSocket
    //    hasn't delivered data yet (cold load) or allMids doesn't include spot pairs.
    if (tradeAsset?.markPx) return Number(tradeAsset.markPx);
    // 3. REST API ticker (last resort — returns zeros for spots without allMids data)
    return price?.markPx || price?.price || 0;
  }, [allMids, symbol, price, tradeAsset]);

  return (
    <div className="container-fluid h-screen flex flex-col py-[clamp(0.25rem,0.8vw,0.5rem)] px-[clamp(0.5rem,1.5vw,1rem)] select-none overflow-hidden">
      {/* Header — fixed height, no scroll */}
      <header className="shrink-0">
        <div className="flex items-center w-full min-w-0 pb-[clamp(0.25rem,1vw,0.375rem)]">
          <TradeDropdown
            currentSymbol={symbol}
            logoUrl={logoUrl ?? undefined}
            displaySymbol={displaySymbol}
            currentDisplayName={displayName}
          />
          {isHip3 && dexPrefix && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary shrink-0 leading-none">
              {dexPrefix}
            </span>
          )}
          <MarketTerminalHeader
            markPrice={liveMarkPrice}
            oraclePrice={price?.midPx || price?.markPx || 0}
            change24hAbs={(price?.markPx || price?.price || 0) - (price?.prevDayPx || 0)}
            change24hPct={price?.change24h || 0}
            volume24h={price?.volume24h || 0}
            openInterest={price?.openInterest || 0}
            fundingRate={price?.funding || 0}
            fundingCountdown={fundingCountdown}
          />
        </div>
        {description && (
          <div className="pb-[clamp(0.15rem,0.5vw,0.25rem)]">
            <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-2xl">
              {description}
            </p>
          </div>
        )}
      </header>

      <L2BookNSigFigsProvider key={symbol}>
        {/* Top section: Chart + Orderbook — ~70% */}
        <div className="flex-8 min-h-0 grid grid-cols-6 gap-[clamp(0.15rem,0.5vw,0.3rem)] items-stretch">
          <div className="col-span-4 flex flex-col min-h-0 h-full">
            {showChartSkeleton ? (
              <Skeleton className="h-full w-full rounded-lg" />
            ) : (
              <div className="animate-in fade-in duration-200 ease-premium h-full">
                <Suspense fallback={<ChartSkeleton />}>
                  <ErrorBoundary>
                    <TradingChart
                      key={chartSymbol}
                      symbol={chartSymbol}
                      interval={interval}
                      onIntervalChange={onIntervalChange}
                    />
                  </ErrorBoundary>
                </Suspense>
              </div>
            )}
          </div>

          <div className="col-span-1 flex flex-col min-h-0">
            <ErrorBoundary>
              <OrderbookWidget key={symbol} symbol={symbol} />
            </ErrorBoundary>
          </div>

          <div className="col-span-1 flex flex-col min-h-0">
            <OrderForm symbol={symbol} markPrice={asset.price?.markPx || asset.price?.price || 0} />
          </div>
        </div>

        {/* Bottom section: Position Management — ~20% */}
        <div className="flex-2 min-h-0 flex flex-col pt-[clamp(0.15rem,0.5vw,0.25rem)]">
          <PositionManagement />
        </div>
      </L2BookNSigFigsProvider>
    </div>
  );
});

function AssetDetailSkeleton() {
  return (
    <div className="container-fluid h-full overflow-y-auto py-[clamp(0.75rem,1.5vw,1.5rem)] overscroll-none">
      <header className="flex items-center gap-3 pb-[clamp(0.25rem,1vw,0.375rem)]">
        <Skeleton className="w-7 h-7 rounded-full" />
        <div>
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
      </header>
      <div className="flex-8 min-h-0 grid grid-cols-6 gap-[clamp(0.15rem,0.5vw,0.3rem)] items-stretch">
        <Skeleton className="col-span-4 h-[clamp(20rem,20rem+1.25vw,31.25rem)] rounded-lg" />
        <Skeleton className="col-span-1 h-[clamp(20rem,20rem+1.25vw,31.25rem)] rounded-xl" />
        <Skeleton className="col-span-1 h-[clamp(20rem,20rem+1.25vw,31.25rem)] rounded-xl" />
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

  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  const normalizedSymbol = rawCoin.toUpperCase();
  // Perps use {COIN}USDT for TradingView mapping; spots use the raw pair name.
  const isSpotUrl = rawCoin.includes("/");
  const chartSymbol = isSpotUrl
    ? rawCoin
    : normalizedSymbol.endsWith("USDT")
      ? normalizedSymbol
      : `${normalizedSymbol}USDT`;

  // Only perp assets support WS subscriptions; spot/outcome would send invalid coins → Hyperliquid drops the connection.
  const { data: tradeListData } = useTradeList();
  const currentAsset = useMemo(() => {
    if (!tradeListData?.assets) return null;
    return tradeListData.assets.find((a) => a.rawCoin.toLowerCase() === rawCoin.toLowerCase());
  }, [tradeListData, rawCoin]);
  // Use discriminated union: only "perp" marketType enables WS.
  // Fail closed: if asset not yet loaded (null), WS stays disabled.
  const enableWsRealtime = currentAsset?.marketType === "perp";

  const {
    data: fetchedAsset,
    isLoading: assetLoading,
    error: assetError,
  } = useQuery({
    queryKey: queryKeys.asset.bySymbol(rawCoin),
    queryFn: () => api.getMarketPrice(rawCoin),
    enabled: !!rawCoin,
    staleTime: 60 * 1000,
    refetchOnMount: true,
    retry: 1,
  });

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

  const { getPrecision } = useHyperliquidMeta();

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
        symbol={rawCoin}
        interval={interval}
        onIntervalChange={handleIntervalChange}
        showChartSkeleton={showChartSkeleton}
      />
    </CandleDataProvider>
  );
}
