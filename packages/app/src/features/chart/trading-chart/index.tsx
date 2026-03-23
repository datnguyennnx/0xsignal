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
 *
 * @composition
 * - useChartEngine: Creates/manages chart instance
 * - useChartData: Handles data updates to series
 * - useICTOverlay: ICT analysis visualization
 * - useWyckoffOverlay: Wyckoff analysis visualization
 */
import { useRef, useState, useCallback, useMemo, memo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { useTheme } from "@/core/providers/theme-provider";
import { useHyperliquidMeta } from "@/features/perp/hooks/use-hyperliquid-meta";
import { useChartConfig } from "@/hooks/use-breakpoint";

import {
  useICTOverlayMemo,
  useICTWorker,
  DEFAULT_ICT_VISIBILITY,
  type ICTVisibility,
  type ICTFeature,
} from "../ict";
import {
  useWyckoffOverlayMemo,
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
import { DepthChartWidget } from "../depth-chart";
import { cn } from "@/core/utils/cn";
import type { ChartViewMode } from "./types";

interface TradingChartProps {
  data: ChartDataPoint[];
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
  loadMore?: (count?: number) => Promise<void>;
  hasMore?: boolean;
  isFetching?: boolean;
}

const TradingChartComponent = ({
  data,
  symbol,
  interval,
  onIntervalChange,
  loadMore,
  hasMore,
  isFetching = false,
}: TradingChartProps) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const chartConfig = useChartConfig();
  const { getPrecision } = useHyperliquidMeta();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [hoveredCandle, setHoveredCandle] = useState<ChartDataPoint | null>(null);
  const displayCandle = hoveredCandle || (data.length > 0 ? data[data.length - 1] : null);
  const chartSymbol = symbol.toUpperCase();
  const [ictVisibility, setIctVisibility] = useState<ICTVisibility>(DEFAULT_ICT_VISIBILITY);
  const [wyckoffVisibility, setWyckoffVisibility] = useState<WyckoffVisibility>(
    DEFAULT_WYCKOFF_VISIBILITY
  );
  const [viewMode, setViewMode] = useState<ChartViewMode>("chart");

  const { isFullscreen, toggleFullscreen, fullscreenContainerRef } = useFullscreen();
  const showOrientationWarning = useOrientationWarning(isFullscreen);

  const ictEnabled = useMemo(() => Object.values(ictVisibility).some(Boolean), [ictVisibility]);
  const wyckoffEnabled = useMemo(
    () => Object.values(wyckoffVisibility).some(Boolean),
    [wyckoffVisibility]
  );

  const { analysis: ictAnalysis, isLoading: ictLoading } = useICTWorker({
    data,
    enabled: ictEnabled && viewMode === "chart",
  });
  const { analysis: wyckoffAnalysis, isLoading: wyckoffLoading } = useWyckoffWorker({
    data,
    enabled: wyckoffEnabled && viewMode === "chart",
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

  // Stable callback wrapper for loadMore
  const handleLoadMore = useCallback(() => {
    loadMore?.(chartConfig.loadMoreCandles);
  }, [loadMore, chartConfig.loadMoreCandles]);

  const { chart, candlestickSeries, volumeSeries } = useChartEngine({
    containerRef: chartContainerRef,
    isDark,
    priceFormat,
    onCrosshairMove: setHoveredCandle,
    onLoadMore: handleLoadMore,
    hasMore: hasMore ?? false,
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
    enabled: viewMode === "chart",
  });

  useICTOverlayMemo({
    chart,
    series: candlestickSeries,
    analysis: ictAnalysis,
    visibility: ictVisibility,
    isDark,
    lastTime,
  });

  useWyckoffOverlayMemo({
    chart,
    series: candlestickSeries,
    analysis: wyckoffAnalysis,
    visibility: wyckoffVisibility,
    isDark,
    lastTime,
  });

  useIndicatorOverlay({
    chart,
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

  const handleViewModeChange = useCallback((mode: ChartViewMode) => {
    setViewMode(mode);
  }, []);

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
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
        />
      </ChartHeader>

      <ChartHeaderMobile
        symbol={chartSymbol}
        interval={interval}
        isFullscreen={isFullscreen}
        onIntervalChange={handleIntervalChange}
        onToggleFullscreen={toggleFullscreen}
        isFetching={isFetching}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
      />

      <div className="flex-1 relative bg-card overscroll-none">
        {/* Candlestick chart container */}
        <div
          ref={chartContainerRef}
          className="absolute inset-0"
          style={{
            pointerEvents: viewMode === "chart" ? "auto" : "none",
            opacity: viewMode === "chart" ? 1 : 0,
          }}
        />
        {/* Depth chart is mounted only in depth mode to avoid hidden realtime work */}
        {viewMode === "depth" && (
          <DepthChartWidget
            symbol={chartSymbol}
            className={cn("absolute inset-0 pointer-events-auto opacity-100")}
          />
        )}
        {/* Indicator chips and overlays only show in chart mode */}
        {viewMode === "chart" && (
          <>
            <IndicatorChips indicators={activeIndicators} />
            <ChartOhlcOverlay displayCandle={displayCandle} precision={precision.pxDecimals} />
          </>
        )}
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
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
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

export const TradingChart = memo(TradingChartComponent);
