import { useEffect, useRef, useState, useCallback, useMemo, startTransition } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { ChartDataPoint, ActiveIndicator, IndicatorConfig } from "@0xsignal/shared";
import { getIndicatorColor, MULTI_INSTANCE_INDICATORS } from "@0xsignal/shared";
import { useTheme } from "@/core/providers/theme-provider";
import { getChartColors, getCandlestickColors } from "@/core/utils/colors";

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

import {
  VOLUME_PANE_HEIGHT,
  INDICATOR_PANE_HEIGHT,
  RESIZE_DELAY,
  INTERVAL_RESTORE_DELAY,
} from "./constants";
import { usePriceFormat, useIndicatorData, useOrientationWarning } from "./hooks";
import { ChartHeader } from "./chart-header";
import { ChartHeaderMobile } from "./chart-header-mobile";
import { ChartControls } from "./chart-controls";
import { ChartOverlays } from "./chart-overlays";
import { OrientationWarning } from "./orientation-warning";

interface TradingChartProps {
  data: ChartDataPoint[];
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
  loadMore?: (count?: number) => Promise<void>;
  hasMore?: boolean;
}

const generateRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 20);
  const lightness = 45 + Math.floor(Math.random() * 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

import { memo } from "react";

// ──────────────────────────────────────────────────────────────
// Helper: convert raw data to lightweight-charts format (inline, no extra hook)
// These are pure transforms — we memoise them here so the chart
// component doesn't pay for a hook call that creates new arrays.
// ──────────────────────────────────────────────────────────────
function toCandlestickData(data: ChartDataPoint[]) {
  return data.map((d) => ({
    time: d.time as Time,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
  }));
}

function toVolumeData(data: ChartDataPoint[], isDark: boolean) {
  return data.map((d) => ({
    time: d.time as Time,
    value: d.volume,
    color:
      d.close >= d.open
        ? isDark
          ? "rgba(38, 166, 154, 0.5)"
          : "#26a69a"
        : isDark
          ? "rgba(239, 83, 80, 0.5)"
          : "#ef5350",
  }));
}

function TradingChartComponent({
  data,
  symbol,
  interval,
  onIntervalChange,
  loadMore,
  hasMore,
}: TradingChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<
    Map<string, { series: ISeriesApi<"Line">[]; paneIndex: number }>
  >(new Map());
  const updateScheduledRef = useRef(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const isFullscreenRef = useRef(false);

  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<ChartDataPoint | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [ictVisibility, setIctVisibility] = useState<ICTVisibility>(DEFAULT_ICT_VISIBILITY);
  const [wyckoffVisibility, setWyckoffVisibility] = useState<WyckoffVisibility>(
    DEFAULT_WYCKOFF_VISIBILITY
  );

  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  const showOrientationWarning = useOrientationWarning(isFullscreen);
  const ictEnabled = Object.values(ictVisibility).some(Boolean);
  const wyckoffEnabled = Object.values(wyckoffVisibility).some(Boolean);

  const { analysis: ictAnalysis, isLoading: ictLoading } = useICTWorker({
    data,
    enabled: ictEnabled,
  });
  const { analysis: wyckoffAnalysis, isLoading: wyckoffLoading } = useWyckoffWorker({
    data,
    enabled: wyckoffEnabled,
  });

  const lastTime = useMemo(() => (data.length > 0 ? data[data.length - 1].time : 0), [data]);

  useICTOverlay({
    chart: chartRef.current,
    series: candlestickSeriesRef.current,
    analysis: ictAnalysis,
    visibility: ictVisibility,
    isDark,
    lastTime,
  });

  useWyckoffOverlay({
    chart: chartRef.current,
    series: candlestickSeriesRef.current,
    analysis: wyckoffAnalysis,
    visibility: wyckoffVisibility,
    isDark,
    lastTime,
  });

  const handleToggleICT = useCallback((feature: ICTFeature) => {
    startTransition(() => {
      setIctVisibility((prev) => ({ ...prev, [feature]: !prev[feature] }));
    });
  }, []);

  const handleToggleWyckoff = useCallback((feature: WyckoffFeature) => {
    startTransition(() => {
      setWyckoffVisibility((prev) => ({ ...prev, [feature]: !prev[feature] }));
    });
  }, []);

  const toggleFullscreen = useCallback(() => setIsFullscreen((prev) => !prev), []);

  const handleResetAll = useCallback(() => {
    setIctVisibility(DEFAULT_ICT_VISIBILITY);
    setWyckoffVisibility(DEFAULT_WYCKOFF_VISIBILITY);
    if (chartRef.current) {
      indicatorSeriesRef.current.forEach((value) => {
        value.series.forEach((s) => {
          try {
            chartRef.current?.removeSeries(s);
          } catch {
            /* ignore */
          }
        });
      });
      indicatorSeriesRef.current.clear();
    }
    setActiveIndicators([]);
  }, []);

  const hasActiveOverlays = activeIndicators.length > 0 || ictEnabled || wyckoffEnabled;

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval === interval) return;
      const wasFullscreen = isFullscreenRef.current;
      onIntervalChange(newInterval);
      if (wasFullscreen) {
        setTimeout(() => setIsFullscreen(true), INTERVAL_RESTORE_DELAY);
      }
    },
    [onIntervalChange, interval]
  );

  useEffect(() => {
    if (!isFullscreen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;
    const timer = setTimeout(() => {
      if (chartContainerRef.current && chartRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect();
        chartRef.current.applyOptions({ width, height });
        chartRef.current.timeScale().fitContent();
      }
    }, RESIZE_DELAY);
    return () => clearTimeout(timer);
  }, [isFullscreen]);

  const displayCandle = hoveredCandle || (data.length > 0 ? data[data.length - 1] : null);
  const priceFormat = usePriceFormat(data);
  const indicatorData = useIndicatorData(activeIndicators, data);

  // ──────────────────────────────────────────────────────────────
  // Refs for tracking data changes across renders — used by effects
  // to determine WHAT kind of update to perform (initial, prepend,
  // append, or single-candle update).
  // ──────────────────────────────────────────────────────────────
  const initialDataLoadedRef = useRef(false);
  const prevDataLenRef = useRef(0);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevLastTimeRef = useRef<number | null>(null);
  const prevLastCandleRef = useRef<ChartDataPoint | null>(null);
  const prevIsDarkRef = useRef(isDark);
  const prevIntervalRef = useRef(interval);
  const isLoadingMoreRef = useRef(false);

  // ──────────────────────────────────────────────────────────────
  // Keep loadMore/hasMore in refs so the scroll handler (created
  // once in the chart-init effect) always has the latest values
  // without needing to re-subscribe.
  // ──────────────────────────────────────────────────────────────
  const loadMoreRef = useRef(loadMore);
  const hasMoreRef = useRef(hasMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
    hasMoreRef.current = hasMore;
  }, [loadMore, hasMore]);

  // ──────────────────────────────────────────────────────────────
  // CHART INITIALISATION (runs only when theme changes)
  // Creates the chart, series, resize observer, crosshair,
  // AND the single scroll handler for infinite history.
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const c = getChartColors(isDark);
    const candle = getCandlestickColors(isDark);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: c.text,
        panes: { separatorColor: c.border, separatorHoverColor: c.grid, enableResize: true },
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: c.border,
        rightOffset: 12,
        barSpacing: 6,
      },
      rightPriceScale: { borderColor: c.border },
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
      priceFormat: priceFormat.formatter
        ? { type: "custom" as const, formatter: priceFormat.formatter }
        : { type: "price" as const, ...priceFormat },
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

    // ── Infinite scroll handler (SINGLE registration) ─────────
    // Uses refs so it never needs to be re-subscribed.
    const handleVisibleRangeChange = (
      logicalRange: import("lightweight-charts").LogicalRange | null
    ): void => {
      if (!logicalRange) return;

      const series = candlestickSeriesRef.current;
      if (!series) return;

      const barsInfo = series.barsInLogicalRange(logicalRange);
      if (!barsInfo) return;

      // barsBefore < 0 means there are bars beyond the left edge
      // barsBefore < 50 means user is near the left edge
      if (
        barsInfo.barsBefore < 50 &&
        loadMoreRef.current &&
        hasMoreRef.current &&
        !isLoadingMoreRef.current
      ) {
        isLoadingMoreRef.current = true;
        loadMoreRef.current(200).finally(() => {
          isLoadingMoreRef.current = false;
        });
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    // ── Resize observer ───────────────────────────────────────
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartRef.current || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });

    resizeObserver.observe(chartContainerRef.current);

    // ── Crosshair ─────────────────────────────────────────────
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }
      const candleData = param.seriesData.get(candlestickSeries);
      if (candleData && "open" in candleData) {
        setHoveredCandle({
          time: param.time as number,
          open: candleData.open,
          high: candleData.high,
          low: candleData.low,
          close: candleData.close,
          volume: 0,
        });
      }
    });

    // Reset tracking when chart is recreated
    initialDataLoadedRef.current = false;
    prevDataLenRef.current = 0;
    prevFirstTimeRef.current = null;
    prevLastTimeRef.current = null;
    prevLastCandleRef.current = null;

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [isDark, priceFormat]);

  // ──────────────────────────────────────────────────────────────
  // UNIFIED DATA EFFECT — determines the type of change and
  // performs the minimal chart operation:
  //
  //   1. Initial load / interval change → setData + fitContent
  //   2. Historical prepend (loadMore) → setData + preserve scroll
  //   3. Real-time last candle update → series.update() (single bar)
  //   4. New candle appended → setData (no fitContent)
  //   5. No meaningful change → SKIP
  //
  // This replaces the old 2-effect approach which had race conditions
  // and redundant setData calls.
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    const chart = chartRef.current;
    const candleSeries = candlestickSeriesRef.current;
    const volSeries = volumeSeriesRef.current;

    // Detect theme or interval change → full reset
    const themeChanged = prevIsDarkRef.current !== isDark;
    const intervalChanged = prevIntervalRef.current !== interval;
    if (themeChanged || intervalChanged) {
      prevIsDarkRef.current = isDark;
      prevIntervalRef.current = interval;
      initialDataLoadedRef.current = false;
    }

    const currentFirstTime = data[0].time;
    const currentLastTime = data[data.length - 1].time;
    const currentLastCandle = data[data.length - 1];
    const prevFirstTime = prevFirstTimeRef.current;
    const prevLastTime = prevLastTimeRef.current;

    // ─── Case 1: Initial load ────────────────────────────────
    if (!initialDataLoadedRef.current) {
      const csData = toCandlestickData(data);
      const volData = toVolumeData(data, isDark);
      candleSeries.setData(csData);
      volSeries.setData(volData);
      chart?.timeScale().fitContent();
      initialDataLoadedRef.current = true;

      // Store tracking state
      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // ─── Case 2: Historical data prepended (loadMore) ────────
    // Detected when the first timestamp is earlier than before
    if (prevFirstTime !== null && currentFirstTime < prevFirstTime) {
      const timeScale = chart?.timeScale();
      const visibleRange = timeScale?.getVisibleLogicalRange();

      const csData = toCandlestickData(data);
      const volData = toVolumeData(data, isDark);
      candleSeries.setData(csData);
      volSeries.setData(volData);

      // Restore visible range to keep current view STABLE — no jumping
      if (visibleRange && timeScale) {
        const barsDiff = data.length - prevDataLenRef.current;
        timeScale.setVisibleLogicalRange({
          from: visibleRange.from + barsDiff,
          to: visibleRange.to + barsDiff,
        });
      }

      // Update tracking
      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // ─── Case 3: Real-time update on the SAME last candle ────
    // Same timestamp, same array length, only OHLCV values changed
    const prevCandle = prevLastCandleRef.current;
    const isSameLastTimestamp = prevLastTime !== null && currentLastTime === prevLastTime;
    const isSameLength = data.length === prevDataLenRef.current;
    const lastCandleChanged =
      prevCandle !== null &&
      (prevCandle.open !== currentLastCandle.open ||
        prevCandle.high !== currentLastCandle.high ||
        prevCandle.low !== currentLastCandle.low ||
        prevCandle.close !== currentLastCandle.close ||
        prevCandle.volume !== currentLastCandle.volume);

    if (isSameLastTimestamp && isSameLength && lastCandleChanged) {
      // Incremental update — only touch the last bar, no re-render
      candleSeries.update({
        time: currentLastCandle.time as Time,
        open: currentLastCandle.open,
        high: currentLastCandle.high,
        low: currentLastCandle.low,
        close: currentLastCandle.close,
      });

      volSeries.update({
        time: currentLastCandle.time as Time,
        value: currentLastCandle.volume,
        color:
          currentLastCandle.close >= currentLastCandle.open
            ? isDark
              ? "rgba(38, 166, 154, 0.5)"
              : "#26a69a"
            : isDark
              ? "rgba(239, 83, 80, 0.5)"
              : "#ef5350",
      });

      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // ─── Case 4: New candle(s) appended via WS ───────────────
    // Last timestamp is newer OR array grew without prepending
    if (
      (prevLastTime !== null && currentLastTime > prevLastTime) ||
      (prevFirstTime !== null &&
        currentFirstTime === prevFirstTime &&
        data.length > prevDataLenRef.current)
    ) {
      const csData = toCandlestickData(data);
      const volData = toVolumeData(data, isDark);
      candleSeries.setData(csData);
      volSeries.setData(volData);
      // Do NOT fitContent — let user keep their scroll position

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // ─── Case 5: No meaningful change — skip ─────────────────
    // (This avoids redundant setData calls)
    prevDataLenRef.current = data.length;
    prevFirstTimeRef.current = currentFirstTime;
    prevLastTimeRef.current = currentLastTime;
    prevLastCandleRef.current = { ...currentLastCandle };
  }, [data, isDark, interval]);

  const getNextPaneIndex = useCallback((): number => {
    const usedPanes = new Set<number>([0, 1]);
    indicatorSeriesRef.current.forEach((v) => {
      if (v.paneIndex > 1) usedPanes.add(v.paneIndex);
    });
    let paneIndex = 2;
    while (usedPanes.has(paneIndex)) paneIndex++;
    return paneIndex;
  }, []);

  const updateIndicatorSeries = useCallback(() => {
    if (!chartRef.current) return;
    const activeIds = new Set(
      activeIndicators.filter((ind) => ind.visible).map((ind) => ind.config.id)
    );

    const toRemove: string[] = [];
    indicatorSeriesRef.current.forEach((value, id) => {
      if (!activeIds.has(id)) {
        value.series.forEach((s) => chartRef.current!.removeSeries(s));
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => indicatorSeriesRef.current.delete(id));

    for (const indicator of activeIndicators) {
      if (!indicator.visible) continue;
      const calcResult = indicatorData.get(indicator.config.id);
      if (!calcResult) continue;

      const existing = indicatorSeriesRef.current.get(indicator.config.id);

      if (calcResult.type === "band") {
        const bandData = calcResult.data as {
          time: number;
          upper: number;
          middle: number;
          lower: number;
        }[];
        if (!existing) {
          const paneIndex = indicator.config.overlayOnPrice ? 0 : getNextPaneIndex();
          const baseColor =
            indicator.color || getIndicatorColor(indicator.config.id.split("-")[0], 0);
          const priceOpts = indicator.config.overlayOnPrice
            ? { priceFormat: { type: "price" as const, ...priceFormat } }
            : {};

          const upperSeries = chartRef.current!.addSeries(
            LineSeries,
            { color: baseColor, lineWidth: 1, lineStyle: 2, ...priceOpts },
            paneIndex
          );
          const middleSeries = chartRef.current!.addSeries(
            LineSeries,
            { color: baseColor, lineWidth: 2, ...priceOpts },
            paneIndex
          );
          const lowerSeries = chartRef.current!.addSeries(
            LineSeries,
            { color: baseColor, lineWidth: 1, lineStyle: 2, ...priceOpts },
            paneIndex
          );

          upperSeries.setData(bandData.map((d) => ({ time: d.time as Time, value: d.upper })));
          middleSeries.setData(bandData.map((d) => ({ time: d.time as Time, value: d.middle })));
          lowerSeries.setData(bandData.map((d) => ({ time: d.time as Time, value: d.lower })));

          indicatorSeriesRef.current.set(indicator.config.id, {
            series: [upperSeries, middleSeries, lowerSeries],
            paneIndex,
          });
        } else {
          existing.series[0].setData(
            bandData.map((d) => ({ time: d.time as Time, value: d.upper }))
          );
          existing.series[1].setData(
            bandData.map((d) => ({ time: d.time as Time, value: d.middle }))
          );
          existing.series[2].setData(
            bandData.map((d) => ({ time: d.time as Time, value: d.lower }))
          );
        }
      } else {
        const lineData = calcResult.data as { time: number; value: number }[];
        if (!existing) {
          const paneIndex = indicator.config.overlayOnPrice ? 0 : getNextPaneIndex();
          const series = chartRef.current!.addSeries(
            LineSeries,
            {
              color: indicator.color || getIndicatorColor(indicator.config.id.split("-")[0], 0),
              lineWidth: 2,
              lastValueVisible: true,
              priceLineVisible: indicator.config.overlayOnPrice,
              ...(indicator.config.overlayOnPrice
                ? { priceFormat: { type: "price" as const, ...priceFormat } }
                : {}),
            },
            paneIndex
          );

          series.setData(lineData.map((d) => ({ time: d.time as Time, value: d.value })));
          indicatorSeriesRef.current.set(indicator.config.id, { series: [series], paneIndex });

          if (!indicator.config.overlayOnPrice && paneIndex > 1) {
            const panes = chartRef.current!.panes();
            if (panes[paneIndex]) panes[paneIndex].setHeight(INDICATOR_PANE_HEIGHT);
          }
        } else {
          existing.series[0].setData(
            lineData.map((d) => ({ time: d.time as Time, value: d.value }))
          );
        }
      }
    }
  }, [activeIndicators, indicatorData, getNextPaneIndex, priceFormat]);

  useEffect(() => {
    if (!chartRef.current || data.length === 0 || updateScheduledRef.current) return;
    updateScheduledRef.current = true;
    requestAnimationFrame(() => {
      updateScheduledRef.current = false;
      updateIndicatorSeries();
    });
  }, [indicatorData, activeIndicators, updateIndicatorSeries, data.length]);

  const handleAddIndicator = useCallback(
    (config: IndicatorConfig, customParams?: Record<string, number>) => {
      const params = customParams || config.defaultParams || {};
      const uniqueId = MULTI_INSTANCE_INDICATORS.includes(
        config.id as (typeof MULTI_INSTANCE_INDICATORS)[number]
      )
        ? `${config.id}-${params.period || 20}`
        : config.id;

      setActiveIndicators((prev) => {
        if (prev.some((ind) => ind.config.id === uniqueId)) return prev;
        return [
          ...prev,
          {
            config: {
              ...config,
              id: uniqueId,
              name: params.period ? `${config.name} (${params.period})` : config.name,
            },
            params,
            visible: true,
            color: generateRandomColor(),
          },
        ];
      });
    },
    []
  );

  const handleRemoveIndicator = useCallback((indicatorId: string) => {
    const seriesData = indicatorSeriesRef.current.get(indicatorId);
    if (seriesData && chartRef.current) {
      seriesData.series.forEach((s) => {
        try {
          chartRef.current?.removeSeries(s);
        } catch {
          /* ignore */
        }
      });
      indicatorSeriesRef.current.delete(indicatorId);
    }
    setActiveIndicators((prev) => prev.filter((ind) => ind.config.id !== indicatorId));
  }, []);

  const handleToggleIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.map((ind) => (ind.config.id === indicatorId ? { ...ind, visible: !ind.visible } : ind))
    );
  }, []);

  const chartContent = (
    <>
      <ChartHeader
        symbol={symbol}
        interval={interval}
        displayCandle={displayCandle}
        onIntervalChange={handleIntervalChange}
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
        symbol={symbol}
        interval={interval}
        isFullscreen={isFullscreen}
        onIntervalChange={handleIntervalChange}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className="flex-1 relative bg-card">
        <div ref={chartContainerRef} className="absolute inset-0" />
        <ChartOverlays
          ictEnabled={ictEnabled}
          ictAnalysis={ictAnalysis}
          ictVisibility={ictVisibility}
          wyckoffEnabled={wyckoffEnabled}
          wyckoffAnalysis={wyckoffAnalysis}
          wyckoffVisibility={wyckoffVisibility}
          activeIndicators={activeIndicators}
          onToggleIndicator={handleToggleIndicator}
          onRemoveIndicator={handleRemoveIndicator}
        />
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
}

// Memoize to prevent unnecessary re-renders - use default shallow comparison
export const TradingChart = memo(TradingChartComponent);
