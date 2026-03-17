/**
 * @fileoverview Trading Chart Component
 *
 * Main candlestick chart component using lightweight-charts.
 *
 * @composition
 * - useChartEngine: Creates/manages chart instance
 * - useChartData: Handles data updates to series
 * - useICTOverlay: ICT analysis visualization
 * - useWyckoffOverlay: Wyckoff analysis visualization
 * - useIndicators: Technical indicators
 *
 * @state
 * - hoveredCandle: Current candle under crosshair
 * - ictVisibility: Toggle ICT features
 * - wyckoffVisibility: Toggle Wyckoff features
 *
 * @memoization
 * - Uses memo to prevent re-renders from parent
 * - useMemo for derived values (precision, lastTime)
 * - useCallback for event handlers
 */
import { useRef, useState, useCallback, useMemo, memo } from "react";
import type { ChartDataPoint, ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { getIndicatorColor, MULTI_INSTANCE_INDICATORS } from "@0xsignal/shared";
import { useTheme } from "@/core/providers/theme-provider";
import { useHyperliquidMeta } from "@/hooks/use-hyperliquid-meta";
import { useChartConfig } from "@/hooks/use-breakpoint";

import {
  useICTOverlay,
  useICTWorker,
  DEFAULT_ICT_VISIBILITY,
  type ICTVisibility,
  type ICTFeature,
} from "../../ict";
import {
  useWyckoffOverlay,
  useWyckoffWorker,
  DEFAULT_WYCKOFF_VISIBILITY,
  type WyckoffVisibility,
  type WyckoffFeature,
} from "../../wyckoff";

import { ChartHeader } from "./chart-header";
import { ChartHeaderMobile } from "./chart-header-mobile";
import { ChartControls } from "./chart-controls";
import { OrientationWarning } from "./orientation-warning";
import {
  usePriceFormat,
  useIndicatorData,
  useOrientationWarning,
  useChartEngine,
  useChartData,
} from "./hooks";
import { INTERVAL_RESTORE_DELAY } from "./constants";
import { useFullscreen } from "./hooks/use-fullscreen";
import { useIndicators } from "./hooks/use-indicators";
import { ChartOhlcOverlay } from "./chart-ohlc-overlay";

interface TradingChartProps {
  data: ChartDataPoint[];
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
  loadMore?: (count?: number) => Promise<void>;
  hasMore?: boolean;
  isFetching?: boolean;
}

const generateRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 20);
  const lightness = 45 + Math.floor(Math.random() * 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const TradingChartComponent = ({
  data,
  symbol,
  interval,
  onIntervalChange,
  loadMore,
  hasMore,
  isFetching = false,
}: TradingChartProps) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartConfig = useChartConfig();
  const { getPrecision } = useHyperliquidMeta();
  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [hoveredCandle, setHoveredCandle] = useState<ChartDataPoint | null>(null);
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
    handleToggleIndicator,
    handleResetAll: resetIndicators,
    hasActiveOverlays,
  } = useIndicators({ priceFormat });

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
  });

  useICTOverlay({
    chart,
    series: candlestickSeries,
    analysis: ictAnalysis,
    visibility: ictVisibility,
    isDark,
    lastTime,
  });

  useWyckoffOverlay({
    chart,
    series: candlestickSeries,
    analysis: wyckoffAnalysis,
    visibility: wyckoffVisibility,
    isDark,
    lastTime,
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

  const displayCandle = hoveredCandle || (data.length > 0 ? data[data.length - 1] : null);
  const chartSymbol = symbol.toUpperCase();

  const chartContent = (
    <>
      <ChartHeader
        symbol={chartSymbol}
        interval={interval}
        displayCandle={displayCandle}
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
          onToggleIndicator={handleToggleIndicator}
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

      <div className="flex-1 relative bg-card">
        <div ref={chartContainerRef} className="absolute inset-0" />
        <ChartOhlcOverlay displayCandle={displayCandle} precision={precision.pxDecimals} />
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
          onToggleIndicator={handleToggleIndicator}
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
        className="fixed inset-0 z-99990 bg-background flex flex-col"
      >
        <div className="w-full h-full max-w-8xl mx-auto flex flex-col">{chartContent}</div>
      </div>
    );
  }

  return (
    <div className="h-full rounded-lg border border-border/50 bg-card overflow-hidden flex flex-col">
      <div className="relative flex-1 flex flex-col">{chartContent}</div>
    </div>
  );
};

export const TradingChart = memo(TradingChartComponent);
