/**
 * @overview Trading Chart Component
 *
 * A high-performance financial chart based on Lightweight Charts (TradingView).
 * Supports technical indicators, multiple timeframes, and real-time streaming.
 * Renders trade markers (B/S circles) via an HTML overlay on top of the chart.
 */
import { useRef, useCallback, useMemo, memo } from "react";
import { useTheme } from "@/core/providers/theme-provider";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { useCandleData } from "@/features/trade/contexts/candle-data-context";
import { useUserFills } from "@/features/trade/hooks/use-user-data";

import { ChartHeader } from "./chart-header";
import { ChartControls } from "./chart-controls";
import { IndicatorChips } from "./indicator-chips";
import {
  usePriceFormat,
  useChartEngine,
  useChartData,
  useFullscreen,
  useIndicators,
} from "./hooks";
import { useIndicatorOverlay } from "./hooks/use-indicator-overlay";
import { useTradeMarkers } from "./hooks/use-trade-markers";
import { intervalToSeconds } from "@/features/trade/utils/trade-markers";
import { INTERVAL_RESTORE_DELAY } from "./constants";
import { ChartOhlcOverlay } from "./chart-ohlc-overlay";
import { HoverProvider, useHoverActions } from "./contexts/hover-context";
import type { HyperliquidFill } from "@/features/trade/utils/trade-markers";
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
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const { getPrecision } = useHyperliquidMeta();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { setHoveredCandle } = useHoverActions();
  const { data, loadMore, hasMore } = useCandleData();

  const { isFullscreen, toggleFullscreen, fullscreenContainerRef } = useFullscreen();

  const precision = useMemo(() => getPrecision(symbol), [symbol, getPrecision]);
  const priceFormat = usePriceFormat(precision.pxDecimals);

  const {
    activeIndicators,
    indicatorData,
    handleAddIndicator,
    handleRemoveIndicator,
    handleResetAll,
    hasActiveOverlays,
  } = useIndicators({ data });

  const handleLoadMore = useCallback(() => {
    return loadMore?.(300);
  }, [loadMore]);

  const { chart, candlestickSeries, volumeSeries } = useChartEngine({
    containerRef: chartContainerRef,
    isDark,
    priceFormat,
    onCrosshairMove: setHoveredCandle,
    onLoadMore: handleLoadMore,
    hasMore: hasMore,
  });

  useChartData({
    data,
    isDark,
    candlestickSeries,
    volumeSeries,
    chart,
    visibleCandles: DESKTOP_CONFIG.visibleCandles,
    enabled: true,
    resetKey: interval,
  });

  useIndicatorOverlay({
    chart,
    mainSeries: candlestickSeries,
    activeIndicators,
    indicatorData,
  });

  // ─── Trade markers: HTML overlay (B/S circles) ──────────────────────────
  const { data: rawFills } = useUserFills();
  const fills = rawFills as HyperliquidFill[] | undefined;

  const timeframeSec = useMemo(() => intervalToSeconds(interval), [interval]);

  const { markers } = useTradeMarkers({
    fills: fills ?? [],
    timeframeSec,
    currentCoin: symbol,
    candles: data,
  });

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval === interval) return;
      onIntervalChange(newInterval);
      if (isFullscreen) {
        setTimeout(() => toggleFullscreen(), INTERVAL_RESTORE_DELAY);
      }
    },
    [interval, onIntervalChange, isFullscreen, toggleFullscreen]
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

      <div className="flex-1 relative bg-card overflow-hidden">
        <div ref={chartContainerRef} className="absolute inset-0 will-change-transform" />
        <TradeMarkersOverlay
          chart={chart}
          series={candlestickSeries}
          markers={markers}
          candles={data}
        />
        <IndicatorChips indicators={activeIndicators} />
        <ChartOhlcOverlay data={data} precision={precision.pxDecimals} />
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
    <div className="h-full rounded-lg bg-card overflow-hidden flex flex-col">
      <div className="relative flex-1 flex flex-col">{chartContent}</div>
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

export const TradingChart = memo(TradingChartComponent);
