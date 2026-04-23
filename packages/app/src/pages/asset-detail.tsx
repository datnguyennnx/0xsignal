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
import { useState, lazy, Suspense, useMemo, memo, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChartCandlestick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { api, type FuturesPrice } from "@/services/api";
import { cn } from "@/core/utils/cn";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { useChartConfig } from "@/hooks/use-breakpoint";
import { queryKeys } from "@/lib/query/query-keys";
import { useDocumentTitle, formatPerpTitle } from "@/hooks/use-document-title";
import { OrderbookWidget } from "@/features/trade/components/orderbook-widget";
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

import {
  formatSignedUsd,
  formatFundingPercent,
  toCountdown,
  getNextFundingMs,
} from "./asset-detail.utils";
import { formatCompactUsd, formatPrice, formatSignedPercent } from "@/core/utils/formatters";

const MetricBlock = memo(function MetricBlock({
  label,
  value,
  secondary,
  tone = "neutral",
}: {
  label: string;
  value: string;
  secondary?: string;
  tone?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="flex-none min-w-[clamp(6.25rem,18vw,8.75rem)] px-[clamp(0.25rem,1vw,0.625rem)] py-0.5">
      <p className="text-[clamp(0.5rem,1.7vw,0.625rem)] uppercase tracking-[0.06em] text-muted-foreground/75 leading-none">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-[clamp(0.72rem,2.8vw,0.86rem)] font-mono-slashed leading-none whitespace-nowrap",
          tone === "positive" && "text-gain",
          tone === "negative" && "text-loss"
        )}
      >
        {value}
      </p>
      {secondary ? (
        <p className="mt-1 text-[clamp(0.56rem,1.9vw,0.66rem)] font-mono-slashed text-muted-foreground leading-none whitespace-nowrap">
          {secondary}
        </p>
      ) : null}
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
    <div className="flex-none max-w-full overflow-x-auto scrollbar-hide" aria-live="polite">
      <div className="inline-flex items-center gap-[clamp(0.125rem,0.8vw,0.5rem)] min-w-max">
        <MetricBlock label="Mark" value={formatPrice(markPrice)} />
        <MetricBlock label="Oracle" value={formatPrice(oraclePrice)} />
        <MetricBlock
          label="24h Change"
          value={`${formatSignedUsd(change24hAbs)} / ${formatSignedPercent(change24hPct)}`}
          tone={changeTone}
        />
        <MetricBlock label="24h Volume" value={formatCompactUsd(volume24h)} />
        <MetricBlock label="Open Interest" value={formatCompactUsd(openInterest)} />
        <MetricBlock
          label="Funding / Countdown"
          value={`${formatFundingPercent(fundingRate)} / ${fundingCountdown}`}
          tone={fundingTone}
        />
      </div>
    </div>
  );
});

const MobileRealtimeHeader = memo(function MobileRealtimeHeader({
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
  const changeTone = change24hPct >= 0 ? "text-gain" : "text-loss";
  const fundingTone = fundingRate >= 0 ? "text-gain" : "text-loss";

  const rows = [
    { label: "Mark", value: formatPrice(markPrice), tone: "text-foreground" },
    { label: "Oracle", value: formatPrice(oraclePrice), tone: "text-foreground" },
    {
      label: "24h Change",
      value: `${formatSignedUsd(change24hAbs)} / ${formatSignedPercent(change24hPct)}`,
      tone: changeTone,
    },
    { label: "24h Volume", value: formatCompactUsd(volume24h), tone: "text-foreground" },
    { label: "Open Interest", value: formatCompactUsd(openInterest), tone: "text-foreground" },
    {
      label: "Funding",
      value: `${formatFundingPercent(fundingRate)} / ${fundingCountdown}`,
      tone: fundingTone,
    },
  ] as const;

  return (
    <div
      className="sm:hidden rounded-lg border border-border/30 bg-card/35 px-2.5 py-2"
      aria-live="polite"
    >
      <div className="grid grid-cols-3 gap-x-2 gap-y-2">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0">
            <p className="text-[9px] uppercase tracking-[0.05em] text-muted-foreground/75 leading-none">
              {row.label}
            </p>
            <p className={cn("mt-1 text-[12px] font-mono-slashed leading-none truncate", row.tone)}>
              {row.value}
            </p>
          </div>
        ))}
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
  readonly price: FuturesPrice;
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
  const navigate = useNavigate();
  const isMobile = useBreakpoint() === "mobile";
  const chartSymbol = symbol.toUpperCase();
  const price = asset.price;
  const [fundingCountdown, setFundingCountdown] = useState(() => toCountdown(getNextFundingMs()));

  useEffect(() => {
    const id = window.setInterval(() => {
      setFundingCountdown(toCountdown(getNextFundingMs()));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const { data: annotation } = useTradeAnnotation(symbol);
  const { data: logoUrl } = useHyperliquidSymbolLogo(symbol);
  const displayName = annotation?.displayName || asset.symbol.toUpperCase();
  const description = annotation?.description;

  return (
    <div className="container-fluid h-full flex flex-col py-[clamp(0.5rem,2vw,1rem)] animate-in fade-in slide-in-from-bottom-1 duration-300 ease-premium overflow-y-auto lg:overflow-hidden overscroll-none select-none">
      {/* Header */}
      <header className="mb-3 sm:mb-5 shrink-0">
        <div className="w-fit max-w-full flex items-center gap-[clamp(0.25rem,1.2vw,0.5rem)] min-w-0 pb-[clamp(0.375rem,1.5vw,0.625rem)]">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={`${displayName} logo`}
              className="size-[clamp(1.5rem,6vw,2rem)] rounded-full shrink-0"
              loading="eager"
              decoding="async"
            />
          )}
          <div className="shrink-0 pr-1">
            <TradeDropdown currentSymbol={displayName} />
          </div>
          {isMobile && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate(`/trade/${symbol}/orderbook`)}
              className="shrink-0 bg-background/70 hover:bg-muted/40"
              aria-label="Open orderbook"
            >
              <ChartCandlestick className="w-4 h-4" />
            </Button>
          )}
          {!isMobile && (
            <MarketTerminalHeader
              markPrice={price?.markPx || price?.price || 0}
              oraclePrice={price?.midPx || price?.markPx || 0}
              change24hAbs={(price?.markPx || price?.price || 0) - (price?.prevDayPx || 0)}
              change24hPct={price?.change24h || 0}
              volume24h={price?.volume24h || 0}
              openInterest={price?.openInterest || 0}
              fundingRate={price?.funding || 0}
              fundingCountdown={fundingCountdown}
            />
          )}
        </div>
        {isMobile && (
          <div className="mt-1.5">
            <MobileRealtimeHeader
              markPrice={price?.markPx || price?.price || 0}
              oraclePrice={price?.midPx || price?.markPx || 0}
              change24hAbs={(price?.markPx || price?.price || 0) - (price?.prevDayPx || 0)}
              change24hPct={price?.change24h || 0}
              volume24h={price?.volume24h || 0}
              openInterest={price?.openInterest || 0}
              fundingRate={price?.funding || 0}
              fundingCountdown={fundingCountdown}
            />
          </div>
        )}
        {description && (
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-2xl line-clamp-2 sm:line-clamp-none">
            {description}
          </p>
        )}
      </header>

      {/* Shared L2 nSigFigs so Orderbook dropdown and Depth chart use the same Hyperliquid aggregation */}
      <L2BookNSigFigsProvider key={symbol}>
        {/* Main Content: Chart + Side Panel */}
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-6 gap-4 lg:gap-5">
          {/* Chart - Takes 5/6 on desktop, fills grid height */}
          <div className="lg:col-span-5 flex-1 min-h-[clamp(18rem,56dvh,34rem)] sm:min-h-[clamp(22rem,60dvh,40rem)] lg:min-h-0 lg:h-full flex flex-col">
            {showChartSkeleton ? (
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

          {/* Side Panel: Orderbook - matched chart height on lg+ */}
          <div className="hidden lg:flex lg:col-span-1 lg:h-full min-h-0 flex-col">
            <div className="h-full min-h-0">
              <OrderbookWidget key={symbol} symbol={symbol} />
            </div>
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

  const asset: AssetViewModel | null = useMemo(() => {
    if (!fetchedAsset) return null;
    return {
      symbol: fetchedAsset.symbol,
      price: fetchedAsset,
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
  const showChartSkeleton = chartLoading && candleData.length === 0;

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
        showChartSkeleton={showChartSkeleton}
      />
    </CandleDataProvider>
  );
}
