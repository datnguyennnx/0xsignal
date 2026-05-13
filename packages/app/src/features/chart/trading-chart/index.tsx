/**
 * @overview Trading Chart Component
 *
 * A high-performance financial chart based on Lightweight Charts (TradingView).
 * Supports technical indicators (Wyckoff, ICT), multiple timeframes, and real-time streaming.
 */
import { useRef, useState, useCallback, useMemo, memo } from "react";
import { useTheme } from "@/core/providers/theme-provider";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { useCandleData } from "@/features/trade/contexts/candle-data-context";

import {
  useICTOverlay,
  useICTWorker,
  DEFAULT_ICT_VISIBILITY,
  type ICTVisibility,
  type ICTFeature,
} from "../analysis/ict";
import {
  useWyckoffOverlay,
  useWyckoffWorker,
  DEFAULT_WYCKOFF_VISIBILITY,
  type WyckoffVisibility,
  type WyckoffFeature,
} from "../analysis/wyckoff";

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
import { INTERVAL_RESTORE_DELAY } from "./constants";
import { ChartOhlcOverlay } from "./chart-ohlc-overlay";
import { HoverProvider, useHoverActions } from "./contexts/hover-context";

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
  const { data, loadMore, hasMore, isFetching } = useCandleData();
  const shouldShowLoadMoreIndicator = isFetching && data.length > 0;

  const [ictVisibility, setIctVisibility] = useState<ICTVisibility>(DEFAULT_ICT_VISIBILITY);
  const [wyckoffVisibility, setWyckoffVisibility] = useState<WyckoffVisibility>(
    DEFAULT_WYCKOFF_VISIBILITY
  );
  const [pendingInterval, setPendingInterval] = useState<string | null>(null);

  const { isFullscreen, toggleFullscreen, fullscreenContainerRef } = useFullscreen();

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
    resetKey: interval, // Force reset on interval change
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
      // Instant feedback - set loading state before data fetch
      setPendingInterval(newInterval);
      // Trigger parent to fetch new data
      onIntervalChange(newInterval);
      // Fullscreen handling
      if (isFullscreen) {
        setTimeout(() => toggleFullscreen(), INTERVAL_RESTORE_DELAY);
      }
    },
    [interval, onIntervalChange, isFullscreen, toggleFullscreen]
  );

  const isIntervalSwitching = pendingInterval !== null && pendingInterval !== interval;

  // Show loading overlay when switching intervals
  const showLoadingOverlay = isIntervalSwitching || shouldShowLoadMoreIndicator;

  const chartContent = (
    <>
      <ChartHeader
        interval={interval}
        onIntervalChange={handleIntervalChange}
        isIntervalSwitching={isIntervalSwitching}
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

      <div className="flex-1 relative bg-card overflow-hidden">
        <div ref={chartContainerRef} className="absolute inset-0 will-change-transform" />
        {showLoadingOverlay && (
          <div className="pointer-events-none absolute left-3 top-3 z-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-2 py-1 text-[clamp(0.5625rem,0.5rem+0.15vw,0.6875rem)] font-medium text-muted-foreground backdrop-blur">
              <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
              Loading
            </div>
          </div>
        )}
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
