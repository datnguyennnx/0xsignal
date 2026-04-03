/**
 * @overview Chart Engine Hook
 *
 * Initializes and manages the `lightweight-charts` instance for the trading view.
 * Handles resizing, crosshair tracking, and coordinate mapping between DOM and Library.
 *
 * @mechanism
 * - utilizes useEffect + ref pattern for theme-aware color updates without re-mounting.
 * - implements an infinite scroll listener (loadMore) for historical candle data.
 * - abstracts data series (Candlestick, Volume) into a stable API for the main component.
 */
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
import { VOLUME_PANE_HEIGHT } from "../constants";

const getChartColors = (isDark: boolean) => ({
  bg: "transparent",
  grid: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
  text: isDark ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.55)",
  border: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.10)",
  crosshair: isDark ? "rgba(255, 255, 255, 0.35)" : "rgba(0, 0, 0, 0.35)",
  volume: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)",
});

const getCandlestickColors = (isDark: boolean) => ({
  upColor: isDark ? "#22c55e" : "#16a34a",
  downColor: isDark ? "#ef4444" : "#dc2626",
  wickUpColor: isDark ? "#22c55e" : "#16a34a",
  wickDownColor: isDark ? "#ef4444" : "#dc2626",
});

interface UseChartEngineProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  isDark: boolean;
  priceFormat: { minMove: number; formatter?: (price: number) => string };
  onCrosshairMove: (candle: ChartDataPoint | null) => void;
  onLoadMore?: () => void;
  hasMore: boolean;
}

interface UseChartEngineResult {
  chart: IChartApi | null;
  candlestickSeries: ISeriesApi<"Candlestick"> | null;
  volumeSeries: ISeriesApi<"Histogram"> | null;
}

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
  const isDarkRef = useRef(isDark);
  const prevIsDarkRef = useRef(isDark);

  useEffect(() => {
    loadMoreCallbackRef.current = onLoadMore;
    hasMoreRef.current = hasMore;
    onCrosshairMoveRef.current = onCrosshairMove;
    isDarkRef.current = isDark;
  }, [onLoadMore, hasMore, onCrosshairMove, isDark]);

  const priceFormatRef = useRef(priceFormat);
  useEffect(() => {
    priceFormatRef.current = priceFormat;
  }, [priceFormat]);

  const initChart = useCallback(() => {
    if (!containerRef.current || chartRef.current) return undefined;

    const c = getChartColors(isDarkRef.current);
    const candle = getCandlestickColors(isDarkRef.current);

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: c.text,
        panes: { separatorColor: c.border, separatorHoverColor: c.grid, enableResize: true },
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: c.border,
        rightOffset: 12,
        barSpacing: 6,
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
      1
    );

    const panes = chart.panes();
    if (panes[1]) panes[1].setHeight(VOLUME_PANE_HEIGHT);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Trigger re-render after chart is ready
    setChartResult({ chart, candlestickSeries, volumeSeries });

    // Infinite scroll handler
    const handleVisibleRangeChange = (logicalRange: { from: number; to: number } | null): void => {
      if (!logicalRange) return;
      if (logicalRange.from < -5 && hasMoreRef.current && !isLoadingMoreRef.current) {
        isLoadingMoreRef.current = true;
        loadMoreCallbackRef.current?.();
        setTimeout(() => {
          isLoadingMoreRef.current = false;
        }, 500);
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // Resize observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartRef.current || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });

    resizeObserver.observe(containerRef.current);

    // Crosshair move
    const handleCrosshairMove: MouseEventHandler<Time> = (param) => {
      if (!param.time || !param.seriesData) {
        onCrosshairMoveRef.current(null);
        return;
      }
      const candleData = param.seriesData.get(candlestickSeries);
      if (candleData && "open" in candleData) {
        onCrosshairMoveRef.current({
          time: param.time as number,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: 0,
        });
      }
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candlestickSeriesRef.current = null;
      volumeSeriesRef.current = null;
      setChartResult({ chart: null, candlestickSeries: null, volumeSeries: null });
    };
  }, [containerRef]);

  useEffect(() => {
    const cleanup = initChart();
    return cleanup;
  }, [initChart]);

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
      const c = getChartColors(isDark);
      const candle = getCandlestickColors(isDark);

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
