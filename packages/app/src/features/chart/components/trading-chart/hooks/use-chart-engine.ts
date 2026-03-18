/**
 * @fileoverview Chart Engine Hook
 *
 * Initializes and manages lightweight-charts instance.
 *
 * @responsibility
 * - Create/destroy chart instance
 * - Add candlestick and volume series
 * - Handle resize with ResizeObserver
 * - Handle infinite scroll (loadMore)
 * - Handle crosshair moves
 *
 * @lifecycle
 * - Creates chart once on mount
 * - Updates on priceFormat or theme change
 * - Cleanup on unmount
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
import { getVolumeColor } from "@/core/utils/colors";
import { getChartColors, getCandlestickColors } from "@/core/utils/colors";
import { VOLUME_PANE_HEIGHT } from "../constants";

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
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const isLoadingMoreRef = useRef(false);
  const loadMoreCallbackRef = useRef(onLoadMore);
  const hasMoreRef = useRef(hasMore);
  const onCrosshairMoveRef = useRef(onCrosshairMove);
  const [, setReady] = useState(false);
  const prevIsDarkRef = useRef(isDark);

  loadMoreCallbackRef.current = onLoadMore;
  hasMoreRef.current = hasMore;
  onCrosshairMoveRef.current = onCrosshairMove;

  const initChart = useCallback(() => {
    if (!containerRef.current || chartRef.current) return;

    const c = getChartColors(isDark);
    const candle = getCandlestickColors(isDark);

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
        minMove: priceFormat.minMove,
        formatter: priceFormat.formatter ?? ((value: number) => `${value}`),
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
    setReady(true);

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
    };
  }, [containerRef, priceFormat]);

  useEffect(() => {
    const cleanup = initChart();
    return cleanup;
  }, [initChart]);

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

  return {
    chart: chartRef.current,
    candlestickSeries: candlestickSeriesRef.current,
    volumeSeries: volumeSeriesRef.current,
  };
};
