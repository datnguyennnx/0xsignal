// Trading Chart - useMemo/useCallback kept for chart library integration
// React 19.2: Uses startTransition for non-urgent overlay updates

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
import {
  calculateLineIndicator,
  calculateBandIndicator,
  isBandIndicator,
  getIndicatorColor,
  MULTI_INSTANCE_INDICATORS,
} from "@0xsignal/shared";
import { IndicatorButton } from "./indicator-button";
import { IndicatorLegend } from "./indicator-legend";
import { cn } from "@/core/utils/cn";

// Generate random vibrant colors for indicators
const generateRandomColor = (): string => {
  const hue = Math.floor(Math.random() * 360);
  const saturation = 70 + Math.floor(Math.random() * 20); // 70-90%
  const lightness = 45 + Math.floor(Math.random() * 15); // 45-60%
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
import { useTheme } from "@/core/providers/theme-provider";
import { getChartColors, getCandlestickColors, getVolumeColor } from "@/core/utils/colors";
import { useICTWorker } from "@/core/workers/use-ict-worker";
import { Maximize2, Minimize2, RotateCcw, RefreshCcw } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  ICTButton,
  ICTLegend,
  useICTOverlay,
  DEFAULT_ICT_VISIBILITY,
  type ICTVisibility,
  type ICTFeature,
} from "../ict";

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

// Hook to detect mobile portrait orientation
const useOrientationWarning = (isFullscreen: boolean) => {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    if (!isFullscreen) {
      setShowWarning(false);
      return;
    }

    const checkOrientation = () => {
      const isMobile = window.innerWidth < 768;
      const isPortrait = window.innerHeight > window.innerWidth;
      setShowWarning(isMobile && isPortrait);
    };

    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);

    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, [isFullscreen]);

  return showWarning;
};

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
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);

  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
  const [hoveredCandle, setHoveredCandle] = useState<ChartDataPoint | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track fullscreen in ref to preserve across data changes
  const isFullscreenRef = useRef(false);

  // Sync ref with state
  useEffect(() => {
    isFullscreenRef.current = isFullscreen;
  }, [isFullscreen]);

  // Orientation warning for mobile portrait
  const showOrientationWarning = useOrientationWarning(isFullscreen);

  // ICT State
  const [ictVisibility, setIctVisibility] = useState<ICTVisibility>(DEFAULT_ICT_VISIBILITY);
  const ictEnabled = Object.values(ictVisibility).some(Boolean);

  // ICT Analysis via Web Worker (offloads heavy computation)
  const { analysis: ictAnalysis } = useICTWorker({
    data,
    enabled: ictEnabled,
  });

  // Last candle time for extending ICT lines
  const lastTime = useMemo(() => {
    return data.length > 0 ? data[data.length - 1].time : 0;
  }, [data]);

  // ICT Overlay rendering
  useICTOverlay({
    chart: chartRef.current,
    analysis: ictAnalysis,
    visibility: ictVisibility,
    isDark,
    lastTime,
  });

  // ICT toggle handler - uses startTransition for non-blocking UI updates
  const handleToggleICT = useCallback((feature: ICTFeature) => {
    startTransition(() => {
      setIctVisibility((prev) => ({
        ...prev,
        [feature]: !prev[feature],
      }));
    });
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  // Reset all overlays (ICT + Indicators)
  const handleResetAll = useCallback(() => {
    // Clear ICT visibility
    setIctVisibility(DEFAULT_ICT_VISIBILITY);

    // Remove all indicator series from chart
    if (chartRef.current) {
      indicatorSeriesRef.current.forEach((value) => {
        value.series.forEach((s) => {
          try {
            chartRef.current?.removeSeries(s);
          } catch {
            // Series may already be removed
          }
        });
      });
      indicatorSeriesRef.current.clear();
    }

    // Clear indicator state
    setActiveIndicators([]);
  }, []);

  // Check if any overlay is active
  const hasActiveOverlays = activeIndicators.length > 0 || ictEnabled;

  // Handle interval change while preserving fullscreen state
  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      // Don't change if same interval
      if (newInterval === interval) return;

      // Store current fullscreen state before parent updates
      const wasFullscreen = isFullscreenRef.current;

      // Call parent handler
      onIntervalChange(newInterval);

      // Restore fullscreen state after a short delay (after parent re-render and chart init)
      if (wasFullscreen) {
        setTimeout(() => {
          setIsFullscreen(true);
        }, 100);
      }
    },
    [onIntervalChange, interval]
  );

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isFullscreen]);

  // Resize chart when fullscreen changes
  useEffect(() => {
    if (!chartRef.current || !chartContainerRef.current) return;

    // Small delay to allow DOM to update
    const timer = setTimeout(() => {
      if (chartContainerRef.current && chartRef.current) {
        const { width, height } = chartContainerRef.current.getBoundingClientRect();
        chartRef.current.applyOptions({ width, height });
        chartRef.current.timeScale().fitContent();
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [isFullscreen]);

  // Current candle for OHLCV display (hovered or latest)
  const displayCandle = hoveredCandle || (data.length > 0 ? data[data.length - 1] : null);

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

    // Crosshair move handler for OHLCV display
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
            color: generateRandomColor(), // Random vibrant color
          },
        ];
      });
    },
    []
  );

  const handleRemoveIndicator = useCallback((indicatorId: string) => {
    // Remove series from chart
    const seriesData = indicatorSeriesRef.current.get(indicatorId);
    if (seriesData && chartRef.current) {
      seriesData.series.forEach((s) => {
        try {
          chartRef.current?.removeSeries(s);
        } catch {
          // Series may already be removed
        }
      });
      indicatorSeriesRef.current.delete(indicatorId);
    }
    // Update state
    setActiveIndicators((prev) => prev.filter((ind) => ind.config.id !== indicatorId));
  }, []);

  const handleToggleIndicator = useCallback((indicatorId: string) => {
    setActiveIndicators((prev) =>
      prev.map((ind) => (ind.config.id === indicatorId ? { ...ind, visible: !ind.visible } : ind))
    );
  }, []);

  // Chart content (shared between normal and fullscreen)
  const chartContent = (
    <>
      {/* Desktop Header */}
      <div className="hidden sm:flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border/50 bg-card">
        {/* Left: Symbol + Timeframe + OHLC */}
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold">{symbol}</h3>
          <div className="flex items-center gap-1">
            {INTERVALS.map((int) => (
              <button
                key={int.value}
                onClick={() => handleIntervalChange(int.value)}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                  interval === int.value
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
              >
                {int.label}
              </button>
            ))}
          </div>
          {/* OHLC Display */}
          {displayCandle && (
            <div className="hidden lg:flex items-center gap-3 text-xs border-l border-border/50 pl-4">
              <span className="text-muted-foreground">
                O <span className="font-mono tabular-nums">{displayCandle.open.toFixed(2)}</span>
              </span>
              <span className="text-muted-foreground">
                H{" "}
                <span className="font-mono tabular-nums text-gain">
                  {displayCandle.high.toFixed(2)}
                </span>
              </span>
              <span className="text-muted-foreground">
                L{" "}
                <span className="font-mono tabular-nums text-loss">
                  {displayCandle.low.toFixed(2)}
                </span>
              </span>
              <span className="text-muted-foreground">
                C{" "}
                <span
                  className={cn(
                    "font-mono tabular-nums",
                    displayCandle.close >= displayCandle.open ? "text-gain" : "text-loss"
                  )}
                >
                  {displayCandle.close.toFixed(2)}
                </span>
              </span>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <ICTButton visibility={ictVisibility} onToggle={handleToggleICT} />
          <IndicatorButton
            activeIndicators={activeIndicators}
            onAddIndicator={handleAddIndicator}
            onRemoveIndicator={handleRemoveIndicator}
            onToggleIndicator={handleToggleIndicator}
          />
          {/* Reset button - only show when overlays active */}
          {hasActiveOverlays && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetAll}
                  className="px-2 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset all overlays</TooltipContent>
            </Tooltip>
          )}
          <Button variant="outline" size="sm" onClick={toggleFullscreen} className="px-3">
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Header - Minimal */}
      <div className="flex sm:hidden items-center justify-between px-3 py-2 border-b border-border/50 bg-card">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold">{symbol}</h3>
          <div className="flex items-center">
            {INTERVALS.map((int) => (
              <button
                key={int.value}
                onClick={() => handleIntervalChange(int.value)}
                className={cn(
                  "px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors",
                  interval === int.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                )}
              >
                {int.label}
              </button>
            ))}
          </div>
        </div>
        {/* Fullscreen only on mobile header */}
        <Button variant="ghost" size="sm" onClick={toggleFullscreen} className="h-7 w-7 p-0">
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </Button>
      </div>

      {/* Chart Area */}
      <div className="flex-1 relative bg-card">
        <div ref={chartContainerRef} className="absolute inset-0" />
        {/* Legends Container */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1.5">
          {/* ICT Legend */}
          {ictEnabled && ictAnalysis && (
            <ICTLegend analysis={ictAnalysis} visibility={ictVisibility} />
          )}
          {/* Indicator Legend */}
          {activeIndicators.length > 0 && (
            <IndicatorLegend
              indicators={activeIndicators}
              onToggle={handleToggleIndicator}
              onRemove={handleRemoveIndicator}
            />
          )}
        </div>
      </div>

      {/* Mobile Bottom Toolbar */}
      <div className="flex sm:hidden items-center justify-center gap-2 px-2 py-1.5 border-t border-border/50 bg-card">
        <ICTButton visibility={ictVisibility} onToggle={handleToggleICT} />
        <IndicatorButton
          activeIndicators={activeIndicators}
          onAddIndicator={handleAddIndicator}
          onRemoveIndicator={handleRemoveIndicator}
          onToggleIndicator={handleToggleIndicator}
        />
        {/* Reset button for mobile */}
        {hasActiveOverlays && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetAll}
            className="px-2 text-muted-foreground"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Mobile Orientation Warning */}
      {showOrientationWarning && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center z-99998 p-6">
          <RotateCcw className="w-12 h-12 text-muted-foreground mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">Rotate Your Device</h3>
          <p className="text-sm text-muted-foreground text-center max-w-[280px]">
            For the best chart experience, please rotate your device to landscape mode.
          </p>
        </div>
      )}
    </>
  );

  // Fullscreen mode
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

  // Normal mode
  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="relative h-[400px] sm:h-[550px] lg:h-[800px] flex flex-col">
        {chartContent}
      </div>
    </div>
  );
}
