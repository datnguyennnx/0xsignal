import { useState, useEffect, useMemo, memo, lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { useIsDesktop } from "@/hooks/use-breakpoint";
import { OrderbookWidget } from "@/features/trade/components/orderbook-widget";
import { PositionManagement } from "@/features/trade/components/position-management";
import { OrderForm } from "@/features/trade/components/order-form";
import { TradeDropdown } from "@/features/trade/components/trade-dropdown";
import { L2BookNSigFigsProvider } from "@/features/trade/contexts/l2-book-nsig-figs-context";
import { useTradeAnnotation } from "@/features/trade/hooks/use-trade-annotation";
import { useHyperliquidSymbolLogo } from "@/features/trade/hooks/use-hyperliquid-symbol-logo";
import { useAllMids } from "@/features/trade/hooks/use-all-mids";
import { useTradeList } from "@/features/trade/hooks/use-trade-list";
import { DashboardGrid, DashboardPanel } from "./dashboard-grid";
import { MarketTerminalHeader } from "./market-terminal-header";
import { toCountdown, getNextFundingMs } from "../utils/format";

const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart })),
);

const ChartSkeleton = () => (
  <div className="h-full w-full flex items-center justify-center bg-card rounded-xl border border-border/20">
    <Skeleton className="h-full w-full rounded-xl bg-muted/50" />
  </div>
);

export interface AssetViewModel {
  readonly symbol: string;
  readonly price: import("@/services/api").MarketPrice;
}

interface AssetContentProps {
  readonly asset: AssetViewModel;
  readonly symbol: string;
  readonly interval: string;
  readonly onIntervalChange: (interval: string) => void;
  readonly showChartSkeleton: boolean;
}

export const AssetContent = memo(function AssetContent({
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
    const id = setInterval(() => {
      setFundingCountdown(toCountdown(getNextFundingMs()));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // `symbol` is the rawCoin from URL (perp: "BTC", spot: "PURR/USDC", HIP-3: "xyz:TSLA")
  const isSpot = symbol.includes("/");
  const { data: annotation } = useTradeAnnotation(isSpot ? "" : symbol);
  const { data: logoUrl } = useHyperliquidSymbolLogo(symbol);

  // Intent-driven: only fetch markets when user interacts with trade dropdown (removes 166kB from critical path)
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

  const isDesktop = useIsDesktop();

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

  // Shared panel variables (deduplicates desktop vs narrow layout)
  const chartPanel = (
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
  );

  const orderbookPanel = (
    <ErrorBoundary>
      <OrderbookWidget key={symbol} symbol={symbol} />
    </ErrorBoundary>
  );

  const orderformPanel = (
    <ErrorBoundary>
      <OrderForm symbol={symbol} markPrice={asset.price?.markPx || asset.price?.price || 0} />
    </ErrorBoundary>
  );

  const positionsPanel = (
    <ErrorBoundary>
      <PositionManagement />
    </ErrorBoundary>
  );

  return (
    <div className="container-fluid flex-1 min-h-0 flex flex-col animate-in fade-in duration-200 ease-premium">
      <header>
        <div className="flex items-center w-full min-w-0">
          <TradeDropdown
            currentSymbol={symbol}
            logoUrl={logoUrl ?? undefined}
            displaySymbol={displaySymbol}
            currentDisplayName={displayName}
            onPrefetchMarkets={() => setMarketsIntent(true)}
          />
          <MarketTerminalHeader
            markPrice={liveMarkPrice}
            oraclePrice={price?.midPx || price?.markPx || 0}
            change24hAbs={
              isSpot && tradeAsset?.prevDayPx
                ? liveMarkPrice - Number(tradeAsset.prevDayPx)
                : (price?.markPx || price?.price || 0) - (price?.prevDayPx || 0)
            }
            change24hPct={
              isSpot && tradeAsset?.prevDayPx && Number(tradeAsset.prevDayPx) > 0
                ? ((liveMarkPrice - Number(tradeAsset.prevDayPx)) / Number(tradeAsset.prevDayPx)) *
                  100
                : price?.change24h || 0
            }
            volume24h={isSpot ? Number(tradeAsset?.dayNtlVlm ?? 0) : price?.volume24h || 0}
            openInterest={price?.openInterest || 0}
            fundingRate={price?.funding || 0}
            fundingCountdown={fundingCountdown}
            marketType={tradeAsset?.marketType}
            marketCap={
              isSpot && tradeAsset?.circulatingSupply
                ? liveMarkPrice * Number(tradeAsset.circulatingSupply)
                : undefined
            }
            contractAddress={isSpot ? tradeAsset?.evmContract : undefined}
          />
        </div>
        {description && (
          <div className="pb-[clamp(0.25rem,0.5vw,0.375rem)]">
            <p className="text-xs text-muted-foreground/70 leading-relaxed max-w-2xl">
              {description}
            </p>
          </div>
        )}
      </header>

      <L2BookNSigFigsProvider key={symbol}>
        <div className="flex-1 min-h-0 flex flex-col gap-[clamp(0.25rem,0.5vw,0.5rem)]">
          {/* ===== DESKTOP (≥1440px): DashboardGrid ===== */}
          {isDesktop ? (
            <div className="flex-1 min-h-0 flex flex-col gap-[clamp(0.25rem,0.5vw,0.5rem)]">
              <DashboardGrid className="min-h-0">
                <DashboardPanel id="chart">
                  {showChartSkeleton ? (
                    <Skeleton className="h-full w-full rounded-lg" />
                  ) : (
                    <div className="animate-in fade-in duration-200 ease-premium h-full">
                      {chartPanel}
                    </div>
                  )}
                </DashboardPanel>
                <DashboardPanel id="orderbook">{orderbookPanel}</DashboardPanel>
                <DashboardPanel id="orderform">{orderformPanel}</DashboardPanel>
                <DashboardPanel id="positions">{positionsPanel}</DashboardPanel>
              </DashboardGrid>
            </div>
          ) : (
            /* ===== NARROW (<1440px): 2×2 Grid ===== */
            <div className="flex-1 min-h-0 grid grid-cols-[7fr_3fr] grid-rows-[auto_auto] gap-[clamp(0.25rem,0.5vw,0.5rem)]">
              {/* Row 1 */}
              <div className="min-w-0 self-stretch">
                {showChartSkeleton ? (
                  <Skeleton className="h-full w-full rounded-lg" />
                ) : (
                  <div className="h-full">{chartPanel}</div>
                )}
              </div>

              <div className="flex flex-col h-fit min-w-0">{orderbookPanel}</div>

              {/* Row 2 */}
              <div className="flex flex-col h-fit min-w-0">{positionsPanel}</div>

              <div className="flex flex-col h-fit min-w-0">{orderformPanel}</div>
            </div>
          )}
        </div>
      </L2BookNSigFigsProvider>
    </div>
  );
});
