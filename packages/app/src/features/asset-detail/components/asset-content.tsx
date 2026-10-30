import { useState, useEffect, useMemo, memo, useLayoutEffect, useRef } from "react";

import type { MarketPrice } from "@/services/api";
import { TradeDropdown } from "@/features/trade/components/trade-dropdown";
import { useAllMids } from "@/features/trade/hooks/use-all-mids";
import { useHyperliquidSymbolLogo } from "@/features/trade/hooks/use-hyperliquid-symbol-logo";
import { useTradeAnnotation } from "@/features/trade/hooks/use-trade-annotation";
import { useTradeList, type TradeListData } from "@/features/trade/hooks/use-trade-list";
import { deriveMarketHeaderValues } from "./market-header-values";
import { AssetTradingGrid } from "./asset-trading-grid";
import { MarketTerminalHeader } from "./market-terminal-header";
import { MetricItem } from "./metric-item";
import { getNextFundingMs, toCountdown } from "../utils/format";

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
 * The 1s countdown and the allMids ticks stop at this subtree: only the market
 * metrics re-render, never the grid, the chart or the dashboard below them.
 */
const LiveMarketHeader = memo(function LiveMarketHeader({
  symbol,
  isSpot,
  price,
  tradeAsset,
}: LiveMarketHeaderProps) {
  const [fundingCountdown, setFundingCountdown] = useState(() => toCountdown(getNextFundingMs()));
  const allMids = useAllMids(symbol !== "");

  useEffect(() => {
    const id = setInterval(() => {
      setFundingCountdown(toCountdown(getNextFundingMs()));
    }, 1000);
    return () => {
      clearInterval(id);
    };
  }, []);

  // The header presents this number as "Price" for spot and "Mark" for perps.
  // allMids is a MID, so it can only back the spot "Price"; perps keep markPx.
  // Presence in the live WS map is the recency signal available (no timestamp is stored).
  const livePrice = useMemo(() => {
    if (isSpot) {
      const wsMid = allMids[symbol] ?? allMids[symbol.toUpperCase()];
      if (wsMid !== undefined && wsMid > 0) return wsMid;
    }
    // Aggregated markets list — spot prices from spotMetaAndAssetCtxs
    //    This is the authoritative source for spot mark prices when WebSocket
    //    hasn't delivered data yet (cold load) or allMids doesn't include spot pairs.
    if (isNonEmpty(tradeAsset?.markPx)) return Number(tradeAsset.markPx);
    // REST API ticker (last resort)
    return price.markPx || price.price || 0;
  }, [allMids, isSpot, symbol, price, tradeAsset]);

  // A zeroed placeholder ticker is not a quote: painting "$0.0000" until the first
  // tick lands reads as a broken market, so the pre-data header stays neutral.
  if (!(livePrice > 0)) {
    return (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <MetricItem label={isSpot ? "Price" : "Mark"} value="—" />
      </div>
    );
  }

  const derived = deriveMarketHeaderValues({ isSpot, livePrice, price, tradeAsset });

  return (
    <MarketTerminalHeader
      markPrice={derived.markPrice}
      oraclePrice={derived.oraclePrice}
      change24hAbs={derived.change24hAbs}
      change24hPct={derived.change24hPct}
      volume24h={derived.volume24h}
      openInterest={derived.openInterest}
      fundingRate={derived.fundingRate}
      fundingCountdown={fundingCountdown}
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
      region.style.setProperty("--trading-header-offset", `${offset}px`);
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
    <div
      ref={regionRef}
      className="container-fluid flex flex-col min-h-[var(--trading-region-height)]"
    >
      <header ref={headerRef} className="container-query shrink-0 flex flex-col">
        <div className="flex flex-wrap items-center w-full min-w-0 gap-y-2">
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
            <p className="basis-full text-right text-xs text-muted-foreground leading-relaxed line-clamp-2 @[80rem]:grow @[80rem]:basis-72 @[80rem]:min-w-72 @[80rem]:ml-6">
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
        markPrice={price?.markPx || price?.price || 0}
      />
    </div>
  );
});
