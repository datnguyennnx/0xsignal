import { useState, useMemo, memo, useLayoutEffect, useRef } from "react";

import type { MarketPrice } from "@/services/api";
import { TradeDropdown } from "@/features/trade/components/trade-dropdown";
import { useMidPrice } from "@/features/trade/hooks/use-all-mids";
import { useHyperliquidSymbolLogo } from "@/features/trade/hooks/use-hyperliquid-symbol-logo";
import { useTradeAnnotation } from "@/features/trade/hooks/use-trade-annotation";
import { useTradeList, type TradeListData } from "@/features/trade/hooks/use-trade-list";
import { useAssetCtx } from "@/stores/use-market-data-store";
import { deriveMarketHeaderValues } from "./market-header-values";
import { AssetTradingGrid } from "./asset-trading-grid";
import { MarketTerminalHeader } from "./market-terminal-header";
import { MetricItem } from "./metric-item";
import { useFundingCountdown, useNextFundingTime } from "../hooks/use-funding-countdown";

const isNonEmpty = (value: string | null | undefined): value is string =>
  typeof value === "string" && value !== "";

export interface AssetViewModel {
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

interface LiveMarketHeaderProps {
  readonly symbol: string;
  readonly isSpot: boolean;
  readonly price: MarketPrice;
  readonly tradeAsset: TradeListData["assets"][number] | undefined;
}

/**
 * Owns the 1s tick: only this leaf re-renders on the tick, so the header and its
 * six metric items keep their last render.
 */
const FundingCountdown = memo(function FundingCountdown({
  nextFundingMs,
}: {
  readonly nextFundingMs: number | null;
}) {
  return useFundingCountdown(nextFundingMs);
});

/**
 * The allMids ticks stop at this subtree: only the market metrics re-render,
 * never the grid, the chart or the dashboard below them.
 */
const LiveMarketHeader = memo(function LiveMarketHeader({
  symbol,
  isSpot,
  price,
  tradeAsset,
}: LiveMarketHeaderProps) {
  // Scalar selectors: an unrelated coin's tick never re-renders this header.
  const upperSymbol = symbol.toUpperCase();
  const mid = useMidPrice(symbol);
  const upperMid = useMidPrice(upperSymbol, isSpot && upperSymbol !== symbol);
  const wsMid = mid ?? upperMid;

  const quote = price.quote ?? null;
  const ctx = useAssetCtx(isSpot ? "" : symbol);
  const nextFundingMs = useNextFundingTime(isSpot ? "" : symbol);
  const livePrice = useMemo(() => {
    if (wsMid !== undefined && wsMid > 0) return wsMid;
    // Aggregated markets list — spot prices from spotMetaAndAssetCtxs
    //    This is the authoritative source for spot mark prices when WebSocket
    //    hasn't delivered data yet (cold load) or allMids doesn't include spot pairs.
    if (isNonEmpty(tradeAsset?.markPx)) return Number(tradeAsset.markPx);
    // REST API ticker (last resort). `null` is absence; `0` is a real zero quote.
    if (quote === null) return null;
    return quote.markPx !== null && quote.markPx !== 0 ? quote.markPx : quote.price;
  }, [wsMid, quote, tradeAsset]);

  const derived = deriveMarketHeaderValues({
    isSpot,
    livePrice,
    price,
    tradeAsset,
    ctx: isSpot ? undefined : ctx,
  });

  // No quote is not a zero price: absence keeps the neutral "--", while a real
  // zero quote flows through and renders "$0.00". The same metrics and the same
  // flex-wrap slots render here so the row keeps its height until the first tick.
  if (derived.markPrice === null) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <MetricItem label={isSpot ? "Price" : "Mark"} value="--" />
        {!isSpot && <MetricItem label="Oracle" value="--" />}
        <MetricItem label="24h Change" value="--" />
        <MetricItem label="24h Volume" value="--" />
        {!isSpot && <MetricItem label="Open Interest" value="--" />}
        {!isSpot && <MetricItem label="Funding / Countdown" value="--" />}
      </div>
    );
  }

  return (
    <MarketTerminalHeader
      markPrice={derived.markPrice}
      oraclePrice={derived.oraclePrice}
      change24hAbs={derived.change24hAbs}
      change24hPct={derived.change24hPct}
      volume24h={derived.volume24h}
      openInterest={derived.openInterest}
      fundingRate={derived.fundingRate}
      fundingCountdown={<FundingCountdown nextFundingMs={nextFundingMs} />}
      marketType={derived.marketType}
      marketCap={derived.marketCap}
      contractAddress={derived.contractAddress}
    />
  );
});

const TradingGrid = memo(AssetTradingGrid);

export const AssetContent = memo(function AssetContent({
  asset,
  symbol,
  interval,
  onIntervalChange,
  showChartSkeleton,
}: AssetContentProps) {
  const price = asset.price;
  const isSpot = symbol.includes("/");

  const regionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  // The grid only gets the region minus the header block and the column gap that follows
  // it. Publishing that offset lets the canvas derive its fit pitch without measuring
  // itself (which would feed the canvas height back into its own row height). Runs before
  // paint, so the first painted frame already has the fit height.
  useLayoutEffect(() => {
    const region = regionRef.current;
    const header = headerRef.current;
    if (region === null || header === null) return () => {};
    const grid = header.nextElementSibling;
    if (grid === null) return () => {};
    const publish = () => {
      const offset = grid.getBoundingClientRect().top - region.getBoundingClientRect().top;
      const next = `${offset}px`;
      // Writing the property re-enters this observer when it changes layout; skip the
      // no-op write so the loop settles after one pass.
      if (region.style.getPropertyValue("--trading-header-offset") === next) return;
      region.style.setProperty("--trading-header-offset", next);
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(header);
    observer.observe(region);
    return () => {
      observer.disconnect();
    };
  }, []);

  // `symbol` is the rawCoin from URL (perp: "BTC", spot: "PURR/USDC", HIP-3: "xyz:TSLA")
  // Intent-driven: only fetch markets when user interacts with trade dropdown (removes 166kB from critical path)
  const [marketsIntent, setMarketsIntent] = useState(false);
  // Not useAssetContext: it reads the whole allMids map, which would re-render this
  // subtree (and everything below it) on every WebSocket message.
  const { data: annotation } = useTradeAnnotation(isSpot ? "" : symbol);
  const { data: logoUrl } = useHyperliquidSymbolLogo(symbol);
  const { data: tradeList } = useTradeList(marketsIntent);
  const annotationName = annotation?.displayName;
  const displayName = isNonEmpty(annotationName) ? annotationName : symbol.toUpperCase();
  const description = annotation?.description;

  // Resolve trade asset from aggregated list by matching rawCoin (case-insensitive)
  const tradeAsset = useMemo(
    () => tradeList?.assets.find((a) => a.rawCoin.toLowerCase() === symbol.toLowerCase()),
    [tradeList, symbol],
  );
  const displaySymbol = tradeAsset?.displaySymbol;

  return (
    <div ref={regionRef} className="container-fluid flex flex-col min-h-(--trading-region-height)">
      <header ref={headerRef} className="container-query shrink-0">
        <div className="flex flex-wrap items-center w-full min-w-0 gap-x-2">
          <TradeDropdown
            currentSymbol={symbol}
            logoUrl={logoUrl ?? undefined}
            displaySymbol={displaySymbol}
            currentDisplayName={displayName}
            onPrefetchMarkets={() => {
              setMarketsIntent(true);
            }}
          />
          <LiveMarketHeader symbol={symbol} isSpot={isSpot} price={price} tradeAsset={tradeAsset} />
          {isNonEmpty(description) && (
            <p className="basis-full text-right type-label text-muted-foreground leading-relaxed line-clamp-2 @[80rem]:grow @[80rem]:basis-[clamp(18rem,20vw,26rem)] @[80rem]:min-w-[clamp(18rem,20vw,26rem)] @[80rem]:ml-6">
              {description}
            </p>
          )}
        </div>
      </header>

      <TradingGrid
        symbol={symbol}
        interval={interval}
        onIntervalChange={onIntervalChange}
        showChartSkeleton={showChartSkeleton}
        markPrice={
          price.quote == null
            ? 0
            : price.quote.markPx !== null && price.quote.markPx !== 0
              ? price.quote.markPx
              : price.quote.price
        }
      />
    </div>
  );
});
