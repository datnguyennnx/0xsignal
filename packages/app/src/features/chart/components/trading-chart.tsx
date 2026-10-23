import { useRef, useCallback } from "react";
import { LiquidGlass } from "@/components/glass";

import { useFullscreen } from "../hooks/use-fullscreen";
import { useIndicators } from "../hooks/use-indicators";
import { useChartFeed } from "../hooks/use-chart-feed";
import { useChartRuntime } from "../hooks/use-chart-runtime";
import { HoverProvider, useHoverActions } from "../contexts/hover-context";
import { INTERVAL_RESTORE_DELAY } from "../utils/constants";
import { ChartCanvas } from "./chart-canvas";

interface TradingChartProps {
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

const TradingChartInner = ({ symbol, interval, onIntervalChange }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const { setHoveredCandle } = useHoverActions();

  const { isFullscreen, toggleFullscreen, fullscreenContainerRef } = useFullscreen();
  const { candles, hasMoreCandles, handleLoadMore, markers } = useChartFeed({ symbol, interval });

  const {
    activeIndicators,
    indicatorData,
    handleAddIndicator,
    handleRemoveIndicator,
    handleResetAll,
    hasActiveOverlays,
  } = useIndicators({ data: candles ?? [] });

  const { chart, candlestickSeries, precision } = useChartRuntime({
    containerRef: chartContainerRef,
    symbol,
    interval,
    candles: candles ?? [],
    hasMore: hasMoreCandles,
    onLoadMore: handleLoadMore,
    onCrosshairMove: setHoveredCandle,
    activeIndicators,
    indicatorData,
  });

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval === interval) return;
      onIntervalChange(newInterval);
      if (isFullscreen) {
        setTimeout(() => {
          toggleFullscreen();
        }, INTERVAL_RESTORE_DELAY);
      }
    },
    [interval, onIntervalChange, isFullscreen, toggleFullscreen],
  );

  const chartContent = (
    <ChartCanvas
      chart={chart}
      candlestickSeries={candlestickSeries}
      candles={candles ?? []}
      markers={markers}
      pxDecimals={precision.pxDecimals}
      interval={interval}
      onIntervalChange={handleIntervalChange}
      activeIndicators={activeIndicators}
      onAddIndicator={handleAddIndicator}
      onRemoveIndicator={handleRemoveIndicator}
      onResetAll={handleResetAll}
      hasActiveOverlays={hasActiveOverlays}
      isFullscreen={isFullscreen}
      onToggleFullscreen={toggleFullscreen}
      chartContainerRef={chartContainerRef}
    />
  );

  // One stable element tree for both modes: swapping subtrees on fullscreen
  // remounts the chart container, orphaning the chart instance.
  return (
    <div
      ref={fullscreenContainerRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-50 material-overlay flex flex-col overflow-hidden"
          : "relative isolate panel-contain flex flex-1 h-full flex-col rounded-xl p-3.5 bg-transparent"
      }
    >
      {!isFullscreen && (
        <LiquidGlass borderRadius="inherit" refraction tint="var(--material-raised-tint)" />
      )}
      <div
        className={
          isFullscreen
            ? "w-full h-full max-w-8xl mx-auto flex flex-col"
            : "relative flex-1 flex flex-col gap-2.5"
        }
      >
        {chartContent}
      </div>
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
