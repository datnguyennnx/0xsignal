import { useRef, useState, useCallback, useEffect } from "react";

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

const supportsNativeFullscreen =
  typeof document !== "undefined" &&
  typeof document.documentElement.requestFullscreen === "function";

const TradingChartInner = ({ symbol, interval, onIntervalChange }: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { setHoveredCandle } = useHoverActions();

  const [isFullscreen, setIsFullscreen] = useState(false);
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

  const toggleFullscreen = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;

    if (!supportsNativeFullscreen) {
      setIsFullscreen((prev) => !prev);
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    // A refused request (permissions policy, stale activation) leaves state to the listener.
    void panel.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    if (!supportsNativeFullscreen) return () => {};

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const isFallbackFullscreen = isFullscreen && !supportsNativeFullscreen;

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval === interval) return;
      onIntervalChange(newInterval);
      if (isFallbackFullscreen) {
        setTimeout(() => {
          setIsFullscreen(false);
        }, INTERVAL_RESTORE_DELAY);
      }
    },
    [interval, onIntervalChange, isFallbackFullscreen],
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
  // remounts the chart container, orphaning the chart instance. In native
  // fullscreen the element itself is in the top layer, so its class list does
  // not change; only the fallback needs the fixed overlay chrome.
  return (
    <div
      ref={panelRef}
      className={
        isFallbackFullscreen
          ? "fixed inset-0 z-50 tier-floating flex flex-col overflow-hidden"
          : "chart-panel relative isolate panel-contain flex flex-1 h-full flex-col rounded-[var(--radius-panel)] p-[var(--panel-pad,1.08rem)] panel-surface"
      }
    >
      <div
        className={
          isFallbackFullscreen
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
