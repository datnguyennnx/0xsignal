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
  const [, setReady] = useState(false);

  loadMoreCallbackRef.current = onLoadMore;
  hasMoreRef.current = hasMore;

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
        formatter: priceFormat.formatter!,
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
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        onCrosshairMove(null);
        return;
      }
      const candleData = param.seriesData.get(candlestickSeries);
      if (candleData && "open" in candleData) {
        onCrosshairMove({
          time: param.time as number,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: 0,
        });
      }
    });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [containerRef, isDark, priceFormat, onCrosshairMove]);

  useEffect(() => {
    const cleanup = initChart();
    return cleanup;
  }, [initChart]);

  return {
    chart: chartRef.current,
    candlestickSeries: candlestickSeriesRef.current,
    volumeSeries: volumeSeriesRef.current,
  };
};
