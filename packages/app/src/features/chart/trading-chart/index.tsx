/**
 * @overview Trading Chart Component
 *
 * A high-performance financial chart based on Lightweight Charts (TradingView).
 * Supports technical indicators (Wyckoff, ICT), multiple timeframes, and real-time streaming.
 *
 * @mechanism
 * - Integrates Lightweight Charts library for canvas-based rendering
 * - Uses custom primitives for advanced indicators (ICT, Wyckoff)
 * - Automatically handles resolution changes and historical data loading
 *
 * @performance
 * - Throttles crosshair and price updates to 60fps
 * - Uses a Worker (in hooks) for heavy indicator calculations to keep UI responsive
 * - Consumes candle data from CandleDataProvider via ref to avoid memo invalidation
 *   from new array references on every candle tick
 *
 * @composition
 * - useChartEngine: Creates/manages chart instance
 * - useChartData: Handles data updates to series
 * - useICTOverlay: ICT analysis visualization
 * - useWyckoffOverlay: Wyckoff analysis visualization
 */
import { useRef, useState, useCallback, useMemo, memo } from "react";
import { useTheme } from "@/core/providers/theme-provider";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { useChartConfig } from "@/hooks/use-breakpoint";
import { useCandleData } from "@/features/trade/contexts/candle-data-context";

import {
  useICTOverlay,
  useICTWorker,
  DEFAULT_ICT_VISIBILITY,
  type ICTVisibility,
  type ICTFeature,
} from "../ict";
import {
  useWyckoffOverlay,
  useWyckoffWorker,
  DEFAULT_WYCKOFF_VISIBILITY,
  type WyckoffVisibility,
  type WyckoffFeature,
} from "../wyckoff";

import { ChartHeader } from "./chart-header";
import { ChartHeaderMobile } from "./chart-header-mobile";
import { ChartControls } from "./chart-controls";
import { OrientationWarning } from "./orientation-warning";
import { IndicatorChips } from "./indicator-chips";
import {
  usePriceFormat,
  useOrientationWarning,
  useChartEngine,
  useChartData,
  useFullscreen,
  useIndicators,
} from "./hooks";
import { useIndicatorOverlay } from "./hooks/use-indicator-overlay";
import { INTERVAL_RESTORE_DELAY } from "./constants";
import { ChartOhlcOverlay } from "./chart-ohlc-overlay";
import { HoverProvider, useHoverActions } from "./contexts/hover-context";

interface TradingChartProps {
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

const TradingChartInner = ({ symbol, interval, onIntervalChange }: TradingChartProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartConfig = useChartConfig();
  const { getPrecision } = useHyperliquidMeta();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { setHoveredCandle } = useHoverActions();
  // Use data (state) for render-phase access, not dataRef
  const { data, loadMore, hasMore, isFetching } = useCandleData();

  const chartSymbol = symbol.toUpperCase();
  const [ictVisibility, setIctVisibility] = useState<ICTVisibility>(DEFAULT_ICT_VISIBILITY);
  const [wyckoffVisibility, setWyckoffVisibility] = useState<WyckoffVisibility>(
    DEFAULT_WYCKOFF_VISIBILITY
  );

  const { isFullscreen, toggleFullscreen, fullscreenContainerRef } = useFullscreen();
  const showOrientationWarning = useOrientationWarning(isFullscreen);

  const ictEnabled = useMemo(() => Object.values(ictVisibility).some(Boolean), [ictVisibility]);
  const wyckoffEnabled = useMemo(
    () => Object.values(wyckoffVisibility).some(Boolean),
    [wyckoffVisibility]
  );

  const { analysis: ictAnalysis, isLoading: ictLoading } = useICTWorker({
    data,
    enabled: ictEnabled,
  });
  const { analysis: wyckoffAnalysis, isLoading: wyckoffLoading } = useWyckoffWorker({
    data,
    enabled: wyckoffEnabled,
  });

  const lastTime = useMemo(() => (data.length > 0 ? data[data.length - 1].time : 0), [data]);

  const precision = useMemo(() => getPrecision(symbol), [symbol, getPrecision]);
  const priceFormat = usePriceFormat(precision.pxDecimals);

  const {
    activeIndicators,
    indicatorData,
    handleAddIndicator,
    handleRemoveIndicator,
    handleResetAll: resetIndicators,
    hasActiveOverlays,
  } = useIndicators({ data });

  const handleLoadMore = useCallback(() => {
    loadMore?.(chartConfig.loadMoreCandles);
  }, [loadMore, chartConfig.loadMoreCandles]);

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
    interval,
    symbol,
    candlestickSeries,
    volumeSeries,
    chart,
    visibleCandles: chartConfig.visibleCandles,
    enabled: true,
  });

  useICTOverlay({
    chart,
    series: candlestickSeries,
    analysis: ictAnalysis,
    visibility: ictVisibility,
    lastTime,
  });

  useWyckoffOverlay({
    chart,
    series: candlestickSeries,
    analysis: wyckoffAnalysis,
    visibility: wyckoffVisibility,
    lastTime,
  });

  useIndicatorOverlay({
    chart,
    mainSeries: candlestickSeries,
    activeIndicators,
    indicatorData,
  });

  const handleToggleICT = useCallback((feature: ICTFeature) => {
    setIctVisibility((prev) => ({ ...prev, [feature]: !prev[feature] }));
  }, []);

  const handleToggleWyckoff = useCallback((feature: WyckoffFeature) => {
    setWyckoffVisibility((prev) => ({ ...prev, [feature]: !prev[feature] }));
  }, []);

  const handleResetAll = useCallback(() => {
    setIctVisibility(DEFAULT_ICT_VISIBILITY);
    setWyckoffVisibility(DEFAULT_WYCKOFF_VISIBILITY);
    resetIndicators();
  }, [resetIndicators]);

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval === interval) return;
      const wasFullscreen = isFullscreen;
      onIntervalChange(newInterval);
      if (wasFullscreen) {
        setTimeout(() => toggleFullscreen(), INTERVAL_RESTORE_DELAY);
      }
    },
    [onIntervalChange, interval, isFullscreen, toggleFullscreen]
  );

  const chartContent = (
    <>
      <ChartHeader
        interval={interval}
        onIntervalChange={handleIntervalChange}
        isFetching={isFetching}
      >
        <ChartControls
          ictVisibility={ictVisibility}
          ictLoading={ictLoading}
          onToggleICT={handleToggleICT}
          wyckoffVisibility={wyckoffVisibility}
          wyckoffLoading={wyckoffLoading}
          onToggleWyckoff={handleToggleWyckoff}
          activeIndicators={activeIndicators}
          onAddIndicator={handleAddIndicator}
          onRemoveIndicator={handleRemoveIndicator}
          hasActiveOverlays={hasActiveOverlays}
          onResetAll={handleResetAll}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      </ChartHeader>

      <ChartHeaderMobile
        symbol={chartSymbol}
        interval={interval}
        isFullscreen={isFullscreen}
        onIntervalChange={handleIntervalChange}
        onToggleFullscreen={toggleFullscreen}
        isFetching={isFetching}
      />

      <div className="flex-1 relative bg-card overscroll-none">
        <div ref={chartContainerRef} className="absolute inset-0" />
        <IndicatorChips indicators={activeIndicators} />
        <ChartOhlcOverlay data={data} precision={precision.pxDecimals} />
      </div>

      {isFullscreen && (
        <ChartControls
          ictVisibility={ictVisibility}
          ictLoading={ictLoading}
          onToggleICT={handleToggleICT}
          wyckoffVisibility={wyckoffVisibility}
          wyckoffLoading={wyckoffLoading}
          onToggleWyckoff={handleToggleWyckoff}
          activeIndicators={activeIndicators}
          onAddIndicator={handleAddIndicator}
          onRemoveIndicator={handleRemoveIndicator}
          hasActiveOverlays={hasActiveOverlays}
          onResetAll={handleResetAll}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          variant="mobile"
        />
      )}

      {showOrientationWarning && <OrientationWarning />}
    </>
  );

  if (isFullscreen) {
    return (
      <div
        ref={fullscreenContainerRef}
        className="fixed inset-0 z-50 bg-background flex flex-col overscroll-none"
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
