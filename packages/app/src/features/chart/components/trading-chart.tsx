// Trading Chart - useMemo/useCallback kept for chart library integration

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
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
import {
  calculateLineIndicator,
  calculateBandIndicator,
  isBandIndicator,
  getIndicatorColor,
  MULTI_INSTANCE_INDICATORS,
} from "@0xsignal/shared";
import { IndicatorButton } from "./indicator-button";
import { cn } from "@/core/utils/cn";
import { useTheme } from "@/core/providers/theme-provider";
import { getChartColors, getCandlestickColors, getVolumeColor } from "@/core/utils/colors";

interface TradingChartProps {
  data: ChartDataPoint[];
  symbol: string;
  interval: string;
  onIntervalChange: (interval: string) => void;
}

const INTERVALS = [
  { value: "15m", label: "15m" },
  { value: "1h", label: "1h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
] as const;

// useMemo kept - expensive price format calculation
const usePriceFormat = (data: ChartDataPoint[]) => {
  return useMemo(() => {
    if (data.length === 0) return { precision: 2, minMove: 0.01 };
    const prices = data.flatMap((d) => [d.open, d.high, d.low, d.close]);
    const minPrice = Math.min(...prices.filter((p) => p > 0));
    if (minPrice === 0) return { precision: 2, minMove: 0.01 };

    const str = minPrice.toString();
    const decimalIndex = str.indexOf(".");
    if (decimalIndex === -1) return { precision: 0, minMove: 1 };

    const decimals = str.slice(decimalIndex + 1);
    let significantIndex = 0;
    for (let i = 0; i < decimals.length; i++) {
      if (decimals[i] !== "0") {
        significantIndex = i;
        break;
      }
    }
    const precision = Math.min(significantIndex + 3, 10);
    return { precision, minMove: Math.pow(10, -precision) };
  }, [data]);
};

// useMemo kept - data transformation for chart library
const useCandlestickData = (data: ChartDataPoint[]) =>
  useMemo(
    () =>
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      })),
    [data]
  );

// useMemo kept - volume data with theme-aware colors
const useVolumeData = (data: ChartDataPoint[], isDark: boolean) =>
  useMemo(
    () =>
      data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: getVolumeColor(d.close >= d.open, isDark),
      })),
    [data, isDark]
  );

// useMemo kept - expensive indicator calculations
const useIndicatorData = (activeIndicators: ActiveIndicator[], data: ChartDataPoint[]) => {
  return useMemo(() => {
    if (data.length === 0) return new Map();
    const results = new Map<string, { type: "line" | "band"; data: unknown }>();

    for (const indicator of activeIndicators) {
      if (!indicator.visible) continue;
      if (isBandIndicator(indicator.config.id)) {
        const bandData = calculateBandIndicator(indicator, data);
        if (bandData?.length) results.set(indicator.config.id, { type: "band", data: bandData });
      } else {
        const lineData = calculateLineIndicator(indicator, data);
        if (lineData?.length) results.set(indicator.config.id, { type: "line", data: lineData });
      }
    }
    return results;
  }, [activeIndicators, data]);
};

export function TradingChart({ data, symbol, interval, onIntervalChange }: TradingChartProps) {
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

  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);

  const priceFormat = usePriceFormat(data);
  const candlestickData = useCandlestickData(data);
  const volumeData = useVolumeData(data, isDark);
  const indicatorData = useIndicatorData(activeIndicators, data);

  // Initialize chart once
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const c = getChartColors(isDark);
    const candle = getCandlestickColors(isDark);

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: c.text,
        panes: {
          separatorColor: c.border,
          separatorHoverColor: c.grid,
          enableResize: true,
        },
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
      priceFormat: { type: "price", precision: 8, minMove: 0.00000001 },
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
    if (panes[1]) panes[1].setHeight(100);

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Use ResizeObserver for more efficient resize handling
    const resizeObserver = new ResizeObserver((entries) => {
      if (!chartRef.current || !entries[0]) return;
      const { width, height } = entries[0].contentRect;
      chartRef.current.applyOptions({ width, height });
    });

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [isDark]);

  // Update data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;
    candlestickSeriesRef.current.applyOptions({ priceFormat: { type: "price", ...priceFormat } });
    candlestickSeriesRef.current.setData(candlestickData);
    volumeSeriesRef.current.setData(volumeData);
    chartRef.current?.timeScale().fitContent();
  }, [candlestickData, volumeData, priceFormat, data.length]);

  // useCallback kept - passed to child components and used in RAF
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

    // Remove inactive
    const toRemove: string[] = [];
    indicatorSeriesRef.current.forEach((value, id) => {
      if (!activeIds.has(id)) {
        value.series.forEach((s) => chartRef.current!.removeSeries(s));
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => indicatorSeriesRef.current.delete(id));

    // Add/update active
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
            if (panes[paneIndex]) panes[paneIndex].setHeight(120);
          }
        } else {
          existing.series[0].setData(
            lineData.map((d) => ({ time: d.time as Time, value: d.value }))
          );
        }
      }
    }
  }, [activeIndicators, indicatorData, getNextPaneIndex, priceFormat]);

  // Update indicators with RAF batching
  useEffect(() => {
    if (!chartRef.current || data.length === 0 || updateScheduledRef.current) return;
    updateScheduledRef.current = true;
    requestAnimationFrame(() => {
      updateScheduledRef.current = false;
      updateIndicatorSeries();
    });
  }, [indicatorData, activeIndicators, updateIndicatorSeries]);

  // useCallback kept - passed to child component
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
        const existingCount = prev.filter((ind) => ind.config.id.startsWith(config.id)).length;
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
            color: getIndicatorColor(config.id, existingCount),
          },
        ];
      });
    },
    []
  );

  const handleRemoveIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) => prev.filter((ind) => ind.config.id !== indicatorId));
  }, []);

  const handleToggleIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.map((ind) => (ind.config.id === indicatorId ? { ...ind, visible: !ind.visible } : ind))
    );
  }, []);

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      {/* Mobile: 280px, Tablet: 450px, Desktop: 600px */}
      <div className="relative h-[280px] sm:h-[450px] lg:h-[600px] flex flex-col">
        {/* Header - Compact on mobile */}
        <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-3 border-b border-border/50">
          <div className="flex items-center gap-2 sm:gap-3">
            <h3 className="text-xs sm:text-sm font-semibold truncate max-w-[80px] sm:max-w-none">
              {symbol}
            </h3>
            <div className="flex items-center gap-0.5 sm:gap-1">
              {INTERVALS.map((int) => (
                <button
                  key={int.value}
                  onClick={() => onIntervalChange(int.value)}
                  className={cn(
                    "px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-medium rounded transition-colors",
                    interval === int.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {int.label}
                </button>
              ))}
            </div>
          </div>

          {/* Indicator Button - Hidden on mobile for cleaner UX */}
          <div className="hidden sm:block">
            <IndicatorButton
              activeIndicators={activeIndicators}
              onAddIndicator={handleAddIndicator}
              onRemoveIndicator={handleRemoveIndicator}
              onToggleIndicator={handleToggleIndicator}
            />
          </div>
        </div>

        <div className="flex-1 relative">
          <div ref={chartContainerRef} className="absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
