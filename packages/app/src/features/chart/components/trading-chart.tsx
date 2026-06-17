import { useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/use-app-store";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { useHyperliquidCandles } from "@/features/trade/hooks/use-hyperliquid-candles";
import { useUserFills } from "@/features/trade/hooks/use-user-data";

import { ChartHeader } from "./chart-header";
import { ChartControls } from "./chart-controls";
import { IndicatorChips } from "./indicator-chips";
import { usePriceFormat } from "../hooks/use-price-format";
import { useChartEngine } from "../hooks/use-chart-engine";
import { useChartData } from "../hooks/use-chart-data";
import { useFullscreen } from "../hooks/use-fullscreen";
import { useIndicators } from "../hooks/use-indicators";
import { useIndicatorOverlay } from "../hooks/use-indicator-overlay";
import { useTradeMarkers } from "../hooks/use-trade-markers";
import { intervalToSeconds } from "@/features/trade/utils/trade-markers";
import { mapToHLInterval } from "@/core/utils/hyperliquid";
import { INTERVAL_RESTORE_DELAY } from "../utils/constants";
import { ChartOhlcOverlay } from "./chart-ohlc-overlay";
import { HoverProvider, useHoverActions } from "../contexts/hover-context";
import type { HyperliquidFill } from "@/features/trade/utils/trade-markers";
import type { UserFill } from "@/services/api";
import { TradeMarkersOverlay } from "./trade-markers-overlay";

const DESKTOP_CONFIG = {
  visibleCandles: 250,
};

interface TradingChartProps {
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

const TradingChartInner = ({ symbol, interval, onIntervalChange }: TradingChartProps) => {
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const isDark = resolvedTheme === "dark";
  const { getPrecision } = useHyperliquidMeta();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { setHoveredCandle } = useHoverActions();
  const {
    data: candles,
    loadMore: loadMoreCandles,
    hasMore: hasMoreCandles,
  } = useHyperliquidCandles({ symbol, interval: mapToHLInterval(interval), limit: 350 });

  const { isFullscreen, toggleFullscreen, fullscreenContainerRef } = useFullscreen();

  const handleLoadMore = useCallback(async () => {
    await loadMoreCandles();
  }, [loadMoreCandles]);

  const precision = useMemo(() => getPrecision(symbol), [symbol, getPrecision]);
  const priceFormat = usePriceFormat(precision.pxDecimals);

  const {
    activeIndicators,
    indicatorData,
    handleAddIndicator,
    handleRemoveIndicator,
    handleResetAll,
    hasActiveOverlays,
  } = useIndicators({ data: candles ?? [] });

  const { chart, candlestickSeries, volumeSeries } = useChartEngine({
    containerRef: chartContainerRef,
    isDark,
    priceFormat,
    onCrosshairMove: setHoveredCandle,
    onLoadMore: handleLoadMore,
    hasMore: hasMoreCandles,
  });

  useChartData({
    data: candles ?? [],
    isDark,
    candlestickSeries,
    volumeSeries,
    chart,
    visibleCandles: DESKTOP_CONFIG.visibleCandles,
    resetKey: interval,
  });

  useIndicatorOverlay({
    chart,
    mainSeries: candlestickSeries,
    activeIndicators,
    indicatorData,
  });

  // Trade markers: HTML overlay (B/S circles)
  const { data: rawFills } = useUserFills();
  const fills = rawFills
    ?.filter((f): f is UserFill & { dir: string } => typeof f.dir === "string")
    .map(
      (f): HyperliquidFill => ({
        coin: f.coin,
        px: f.px,
        sz: f.sz,
        side: f.side,
        time: f.time,
        dir: f.dir,
        hash: f.hash,
      }),
    );

  const timeframeSec = useMemo(() => intervalToSeconds(interval), [interval]);

  const { markers } = useTradeMarkers({
    fills: fills ?? [],
    timeframeSec,
    currentCoin: symbol,
    candles: candles ?? [],
  });

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval === interval) return;
      onIntervalChange(newInterval);
      if (isFullscreen) {
        setTimeout(() => toggleFullscreen(), INTERVAL_RESTORE_DELAY);
      }
    },
    [interval, onIntervalChange, isFullscreen, toggleFullscreen],
  );

  const chartContent = (
    <>
      <ChartHeader interval={interval} onIntervalChange={handleIntervalChange}>
        <ChartControls
          activeIndicators={activeIndicators}
          onAddIndicator={handleAddIndicator}
          onRemoveIndicator={handleRemoveIndicator}
          hasActiveOverlays={hasActiveOverlays}
          onResetAll={handleResetAll}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </ChartHeader>

      <div className="flex-1 relative overflow-hidden rounded-lg">
        <div ref={chartContainerRef} className="absolute inset-0 will-change-transform" />
        {(candles ?? []).length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground/50 pointer-events-none">
            No recent data
          </div>
        )}
        <TradeMarkersOverlay
          chart={chart}
          series={candlestickSeries}
          markers={markers}
          candles={candles ?? []}
        />
        <IndicatorChips indicators={activeIndicators} />
        <ChartOhlcOverlay data={candles ?? []} precision={precision.pxDecimals} />
      </div>
    </>
  );

  if (isFullscreen) {
    return (
      <div
        ref={fullscreenContainerRef}
        className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden"
      >
        <div className="w-full h-full max-w-8xl mx-auto flex flex-col">{chartContent}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 h-full flex-col rounded-xl border border-border/20 p-4 bg-card animate-in fade-in duration-200 ease-premium">
      <div className="relative flex-1 flex flex-col gap-[clamp(1rem,1vw,1rem)]">{chartContent}</div>
    </div>
  );
};

const TradingChartComponent = (props: TradingChartProps) => {
  return (
    <HoverProvider>
      <TradingChartInner {...props} />
    </HoverProvider>
  );
};

export const TradingChart = TradingChartComponent;
