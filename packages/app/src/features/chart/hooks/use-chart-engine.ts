import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type MouseEventHandler,
  type Time,
} from "lightweight-charts";
import type { ChartDataPoint } from "@0xsignal/shared";
import { VOLUME_PANE_HEIGHT } from "../utils/constants";
import { toRgb } from "../lib/color";

const readToken = (token: string): string =>
  toRgb(getComputedStyle(document.documentElement).getPropertyValue(token).trim());

const getChartColors = () => ({
  grid: readToken("--chart-grid"),
  text: readToken("--chart-text"),
  border: readToken("--chart-border"),
  crosshair: readToken("--chart-crosshair"),
  volume: readToken("--chart-grid"),
});

const getCandlestickColors = () => ({
  upColor: readToken("--candle-up"),
  downColor: readToken("--candle-down"),
  wickUpColor: readToken("--candle-up"),
  wickDownColor: readToken("--candle-down"),
});

interface UseChartEngineProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
  priceFormat: { minMove: number; formatter?: (price: number) => string };
  onCrosshairMove: (candle: ChartDataPoint | null) => void;
  onLoadMore?: () => Promise<void> | void;
  hasMore: boolean;
}

interface UseChartEngineResult {
  chart: IChartApi | null;
  candlestickSeries: ISeriesApi<"Candlestick"> | null;
  volumeSeries: ISeriesApi<"Histogram"> | null;
}

const LOAD_MORE_LEFT_BARS_THRESHOLD = 30;
const LOAD_MORE_LOGICAL_FROM_THRESHOLD = -5;
const LOAD_MORE_FALLBACK_UNLOCK_MS = 1500;
const LOAD_MORE_LEFT_MOVE_EPSILON = 0.01;

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

const sameCandle = (a: ChartDataPoint, b: ChartDataPoint): boolean =>
  a.time === b.time &&
  a.open === b.open &&
  a.high === b.high &&
  a.low === b.low &&
  a.close === b.close;

export const useChartEngine = ({
  containerRef,
  isDark,
  priceFormat,
  onCrosshairMove,
  onLoadMore,
  hasMore,
}: UseChartEngineProps): UseChartEngineResult => {
  const [chartResult, setChartResult] = useState<UseChartEngineResult>({
    chart: null,
    candlestickSeries: null,
    volumeSeries: null,
  });
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const isLoadingMoreRef = useRef(false);
  const loadMoreCallbackRef = useRef(onLoadMore);
  const hasMoreRef = useRef(hasMore);
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  const hoveredCandleRef = useRef<ChartDataPoint | null>(null);
  const prevIsDarkRef = useRef(isDark);
  const hasSeenLogicalRangeRef = useRef(false);
  const prevLogicalFromRef = useRef<number | null>(null);
  // The container can be remounted (e.g. fullscreen toggle) while the ref
  // object stays identical, so the actual element has to be tracked.
  const activeElementRef = useRef<HTMLDivElement | null>(null);
  const teardownRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadMoreCallbackRef.current = onLoadMore;
    hasMoreRef.current = hasMore;
    onCrosshairMoveRef.current = onCrosshairMove;
  }, [onLoadMore, hasMore, onCrosshairMove]);

  const priceFormatRef = useRef(priceFormat);
  useEffect(() => {
    priceFormatRef.current = priceFormat;
  }, [priceFormat]);

  const initChart = useCallback((container: HTMLDivElement) => {
    const c = getChartColors();
    const candle = getCandlestickColors();

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: c.text,
        panes: { separatorColor: c.border, separatorHoverColor: c.grid, enableResize: true },
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: c.border,
        rightOffset: 12,
        barSpacing: 6,
        // LWC v5.1: auto-merge invisible data points when zoomed out
        enableConflation: true,
        conflationThresholdFactor: 2.0,
        precomputeConflationOnInit: false,
      },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      rightPriceScale: {
        borderColor: c.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
        autoScale: true,
      },
      crosshair: {
        mode: 1,
        vertLine: { width: 1, color: c.crosshair, style: 3 },
        horzLine: { width: 1, color: c.crosshair, style: 3 },
      },
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: candle.upColor,
      downColor: candle.downColor,
      borderVisible: false,
      wickUpColor: candle.wickUpColor,
      wickDownColor: candle.wickDownColor,
      priceFormat: {
        type: "custom" as const,
        minMove: priceFormatRef.current.minMove,
        formatter: priceFormatRef.current.formatter ?? ((value: number) => `${value}`),
      },
    });

    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        color: c.volume,
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1,
    );

    const panes = chart.panes();
    if (panes.length > 1) panes[1].setHeight(VOLUME_PANE_HEIGHT);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    hasSeenLogicalRangeRef.current = false;
    prevLogicalFromRef.current = null;
    isLoadingMoreRef.current = false;
    hoveredCandleRef.current = null;

    // Trigger re-render after chart is ready
    setChartResult({ chart, candlestickSeries, volumeSeries });

    // Infinite scroll handler
    const handleVisibleRangeChange = (logicalRange: { from: number; to: number } | null): void => {
      if (!logicalRange) return;

      const prevFrom = prevLogicalFromRef.current;
      prevLogicalFromRef.current = logicalRange.from;

      if (!hasSeenLogicalRangeRef.current) {
        hasSeenLogicalRangeRef.current = true;
        return;
      }

      const movedLeft =
        typeof prevFrom === "number" && logicalRange.from < prevFrom - LOAD_MORE_LEFT_MOVE_EPSILON;
      if (!movedLeft) return;

      const barsInfo = candlestickSeriesRef.current?.barsInLogicalRange(logicalRange);
      const isNearLeftByBars =
        typeof barsInfo?.barsBefore === "number" &&
        barsInfo.barsBefore < LOAD_MORE_LEFT_BARS_THRESHOLD;
      const isNearLeftByLogical = logicalRange.from < LOAD_MORE_LOGICAL_FROM_THRESHOLD;

      if (!(isNearLeftByBars || isNearLeftByLogical)) return;
      if (!hasMoreRef.current || isLoadingMoreRef.current) return;

      isLoadingMoreRef.current = true;
      const loadResult = loadMoreCallbackRef.current?.();
      if (isPromiseLike(loadResult)) {
        void loadResult.finally(() => {
          isLoadingMoreRef.current = false;
        });
      } else {
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, LOAD_MORE_FALLBACK_UNLOCK_MS);
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // autoSize handles resize — no manual ResizeObserver (causes disposed errors).

    // The crosshair fires on every pointer move; publish only when the candle
    // under the pointer actually changes, so hover never re-renders needlessly.
    const publishHover = (next: ChartDataPoint | null): void => {
      const previous = hoveredCandleRef.current;
      if (previous === next) return;
      if (previous !== null && next !== null && sameCandle(previous, next)) return;
      hoveredCandleRef.current = next;
      onCrosshairMoveRef.current(next);
    };

    const handleCrosshairMove: MouseEventHandler<Time> = (param) => {
      const { time } = param;
      if (time === undefined || time === null || time === 0 || time === "") {
        publishHover(null);
        return;
      }
      const candleData = param.seriesData?.get(candlestickSeries);
      if (candleData === undefined || !("open" in candleData)) return;
      if (typeof time !== "number") return;
      publishHover({
        time,
        open: candleData.open,
        high: candleData.high,
        low: candleData.low,
        close: candleData.close,
        volume: 0,
      });
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      hoveredCandleRef.current = null;
      setChartResult({ chart: null, candlestickSeries: null, volumeSeries: null });
    };
  }, []);

  // Runs after every commit: re-initializes the engine when the container
  // element itself changes (remount), tearing the previous chart down first.
  useEffect(() => {
    const container = containerRef.current;
    if (container === activeElementRef.current && teardownRef.current !== null) return;

    teardownRef.current?.();
    teardownRef.current = null;
    activeElementRef.current = container;

    if (container === null) return;
    teardownRef.current = initChart(container);
  });

  useEffect(() => {
    return () => {
      teardownRef.current?.();
      teardownRef.current = null;
      activeElementRef.current = null;
    };
  }, []);

  // Handle dynamic price format updates without re-creating the chart
  useEffect(() => {
    if (!candlestickSeriesRef.current) return;
    candlestickSeriesRef.current.applyOptions({
      priceFormat: {
        type: "custom" as const,
        minMove: priceFormat.minMove,
        formatter: priceFormat.formatter ?? ((value: number) => `${value}`),
      },
    });
  }, [priceFormat]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (prevIsDarkRef.current !== isDark) {
      prevIsDarkRef.current = isDark;
      const c = getChartColors();
      const candle = getCandlestickColors();

      chartRef.current.applyOptions({
        layout: { textColor: c.text },
        grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
        timeScale: { borderColor: c.border },
        rightPriceScale: { borderColor: c.border },
        crosshair: { vertLine: { color: c.crosshair }, horzLine: { color: c.crosshair } },
      });

      if (candlestickSeriesRef.current) {
        candlestickSeriesRef.current.applyOptions({
          upColor: candle.upColor,
          downColor: candle.downColor,
          wickUpColor: candle.wickUpColor,
          wickDownColor: candle.wickDownColor,
        });
      }

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.applyOptions({ color: c.volume });
      }
    }
  }, [isDark]);

  return chartResult;
};
