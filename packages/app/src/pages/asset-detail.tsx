/**
 * Trade view page: chart + orderbook + position management per symbol.
 */
import { useState, lazy, Suspense, useMemo, memo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { normalizeSymbol } from "@/features/trade/lib/symbol";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api, type MarketPrice } from "@/services/api";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
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
import { useAllMids } from "@/features/trade/hooks/use-all-mids";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";

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

  // Markets list is intent-driven: only fetch when user interacts with trade dropdown.
  // This removes 166kB from the initial render critical path.
  const [marketsIntent, setMarketsIntent] = useState(false);
  const { data: tradeList } = useTradeList(marketsIntent);
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
            onPrefetchMarkets={() => setMarketsIntent(true)}
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
    <div className="container-fluid h-screen flex flex-col pt-3 pb-2 px-4 select-none overflow-hidden">
      <header className="flex items-center gap-3 shrink-0 pb-1.5">
        <Skeleton className="size-7 rounded-full" />
        <Skeleton className="h-4 w-48" />
      </header>
      {/* Chart + Orderbook + OrderForm skeleton rows — matches flex-8 grid in AssetContent */}
      <div className="flex-8 min-h-0 grid grid-cols-6 gap-0.5 items-stretch">
        <Skeleton className="col-span-4 rounded-lg" />
        <Skeleton className="col-span-2 rounded-lg" />
      </div>
      {/* Position management skeleton — matches flex-2 area */}
      <div className="flex-2 min-h-0 pt-0.5 flex flex-col">
        <Skeleton className="h-full w-full rounded-lg" />
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

  // WS enabled by default — backend validates perp-only server-side (rejects spot/outcome).
  // Markets list is loaded lazily (trade dropdown intent), not needed for above-the-fold render.
  const enableWsRealtime = true;

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
    // Show previous price data while loading next symbol
    placeholderData: (prev) => prev,
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
