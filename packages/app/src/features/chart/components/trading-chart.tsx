import { useRef, useState, useCallback, useEffect } from "react";

import { useIndicators } from "../hooks/use-indicators";
import { useChartFeed } from "../hooks/use-chart-feed";
import { useChartRuntime } from "../hooks/use-chart-runtime";
import { HoverProvider, useHoverActions } from "../contexts/hover-context";
import { INTERVAL_RESTORE_DELAY } from "../utils/constants";
import { usePriceLines, type ChartPriceLine } from "../lib/price-lines";
import { ChartCanvas } from "./chart-canvas";
import { Surface } from "@/components/surface/surface";
import type { LogicalTradeMarker } from "@/features/trade/utils/trade-markers";

interface TradingChartProps {
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
  priceLines?: readonly ChartPriceLine[] | undefined;
  /** Fills to draw; omit for the viewer's own feed. */
  markers?: readonly LogicalTradeMarker[] | undefined;
}

const supportsNativeFullscreen =
  typeof document !== "undefined" &&
  typeof document.documentElement.requestFullscreen === "function";

const TradingChartInner = ({
  symbol,
  interval,
  onIntervalChange,
  priceLines,
  markers: markersOverride,
}: TradingChartProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { setHoveredCandle } = useHoverActions();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const {
    candles,
    hasMoreCandles,
    handleLoadMore,
    markers: feedMarkers,
    candleError,
  } = useChartFeed({ symbol, interval, fillsEnabled: markersOverride === undefined });

  const markers = markersOverride ?? feedMarkers;

  const {
    activeIndicators,
    indicatorData,
    handleAddIndicator,
    handleRemoveIndicator,
    handleResetAll,
    hasActiveOverlays,
  } = useIndicators({ data: candles ?? [] });

  const { chart, candlestickSeries } = useChartRuntime({
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

  usePriceLines(chart, candlestickSeries, priceLines);

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
      loadError={candleError !== null}
      markers={markers}
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

  // One tree for both modes: a fullscreen remount would orphan the chart instance.
  return (
    <div
      ref={panelRef}
      className={
        isFallbackFullscreen
          ? "fixed inset-0 z-50 isolate flex flex-col overflow-hidden"
          : "chart-panel relative isolate panel-contain flex flex-1 h-full flex-col p-[var(--panel-pad,1.08rem)]"
      }
    >
      <Surface
        tier={isFallbackFullscreen ? "solid" : "content"}
        radius="panel"
        className={
          isFallbackFullscreen
            ? "pointer-events-none absolute inset-0 -z-10 rounded-none glass-no-specular"
            : "pointer-events-none absolute inset-0 -z-10 glass-no-specular"
        }
      />
      <div
        className={
          isFallbackFullscreen
            ? "relative w-full h-full max-w-8xl mx-auto flex flex-col"
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
