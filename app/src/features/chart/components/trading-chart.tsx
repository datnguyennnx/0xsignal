import { useEffect, useRef, useState } from "react";
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
import type { ChartDataPoint } from "@/domain/chart/types";
import type { ActiveIndicator, IndicatorConfig } from "@/domain/chart/indicators/types";
import { ChartSidebar } from "./chart-sidebar";
import { cn } from "@/core/utils/cn";
import { Settings2 } from "lucide-react";
import {
  calculateSMA,
  calculateEMA,
  calculateVWAP,
  calculateRSI,
  calculateMACD,
  calculateStochastic,
  calculateATR,
  calculateCCI,
  calculateWilliamsR,
  calculateOBV,
  calculateMFI,
  calculateBollingerBands,
  calculateKeltnerChannels,
  calculateDonchianChannels,
} from "@/domain/chart/indicators/calculations";

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

export function TradingChart({ data, symbol, interval, onIntervalChange }: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, { series: ISeriesApi<any>; paneIndex: number }>>(
    new Map()
  );

  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicator[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Initialize chart with multi-pane support
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#9ca3af",
        panes: {
          separatorColor: "#374151",
          separatorHoverColor: "rgba(55, 65, 81, 0.5)",
          enableResize: true,
        },
      },
      grid: {
        vertLines: { color: "#1f2937" },
        horzLines: { color: "#1f2937" },
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#374151",
        rightOffset: 12,
        barSpacing: 6,
        lockVisibleTimeRangeOnResize: true,
        rightBarStaysOnScroll: true,
      },
      rightPriceScale: {
        borderColor: "#374151",
      },
      crosshair: {
        mode: 1,
        vertLine: { width: 1, color: "#758696", style: 3 },
        horzLine: { width: 1, color: "#758696", style: 3 },
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });

    // Candlestick series on pane 0 (main)
    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });

    // Volume series on pane 1 (separate pane)
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      {
        color: "#6366f1",
        priceFormat: { type: "volume" },
        lastValueVisible: false,
        priceLineVisible: false,
      },
      1 // Pane index 1
    );

    // Set volume pane height
    const panes = chart.panes();
    if (panes[1]) {
      panes[1].setHeight(100);
    }

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // Update data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current || data.length === 0) return;

    candlestickSeriesRef.current.setData(
      data.map((d) => ({
        time: d.time as Time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }))
    );

    volumeSeriesRef.current.setData(
      data.map((d) => ({
        time: d.time as Time,
        value: d.volume,
        color: d.close >= d.open ? "#26a69a" : "#ef5350",
      }))
    );

    updateIndicators();

    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [data, symbol, activeIndicators]);

  // Update indicators with multi-pane support
  const updateIndicators = () => {
    if (!chartRef.current || data.length === 0) return;

    // Track which indicators should exist
    const activeIndicatorIds = new Set(
      activeIndicators.filter((ind) => ind.visible).map((ind) => ind.config.id)
    );

    // Remove indicators that are no longer active or visible
    const indicatorsToRemove: string[] = [];
    indicatorSeriesRef.current.forEach((value, id) => {
      if (!activeIndicatorIds.has(id)) {
        chartRef.current!.removeSeries(value.series);
        indicatorsToRemove.push(id);
      }
    });
    indicatorsToRemove.forEach((id) => indicatorSeriesRef.current.delete(id));

    // Add or update active indicators
    activeIndicators.forEach((indicator) => {
      if (!indicator.visible) return;

      const indicatorData = calculateIndicator(indicator, data);
      if (!indicatorData || indicatorData.length === 0) {
        return; // Skip if no data calculated
      }

      const existingSeries = indicatorSeriesRef.current.get(indicator.config.id);

      if (!existingSeries) {
        // Determine pane index for new indicator
        const paneIndex = indicator.config.overlayOnPrice ? 0 : getNextPaneIndex();

        // Create new series in appropriate pane
        const series = chartRef.current!.addSeries(
          LineSeries,
          {
            color: indicator.color || getIndicatorColor(indicator.config.id),
            lineWidth: 2,
            title: indicator.config.name,
            lastValueVisible: true,
            priceLineVisible: indicator.config.overlayOnPrice, // Show price line for overlays
          },
          paneIndex
        );

        series.setData(indicatorData);
        indicatorSeriesRef.current.set(indicator.config.id, { series, paneIndex });

        // Configure pane height for oscillators (non-overlay indicators)
        if (!indicator.config.overlayOnPrice && paneIndex > 1) {
          const panes = chartRef.current!.panes();
          if (panes[paneIndex]) {
            panes[paneIndex].setHeight(120);
          }
        }
      } else {
        // Update existing series data
        existingSeries.series.setData(indicatorData);
      }
    });

    // Note: Empty panes are automatically removed by lightweight-charts
    // when all series are removed from them
  };

  // Get next available pane index for non-overlay indicators
  const getNextPaneIndex = (): number => {
    // Pane 0: Price chart (candlesticks + overlay indicators)
    // Pane 1: Volume (always present)
    // Pane 2+: Oscillators and other indicators

    const usedPanes = new Set<number>([0, 1]); // Reserve panes 0 and 1

    // Find which panes are currently in use by non-overlay indicators
    indicatorSeriesRef.current.forEach((value) => {
      if (value.paneIndex > 1) {
        usedPanes.add(value.paneIndex);
      }
    });

    // Find first available pane index starting from 2
    let paneIndex = 2;
    while (usedPanes.has(paneIndex)) {
      paneIndex++;
    }
    return paneIndex;
  };

  // Calculate indicator using consolidated library
  const calculateIndicator = (indicator: ActiveIndicator, data: ChartDataPoint[]) => {
    const { id } = indicator.config;
    // Extract base indicator type (e.g., "sma-20" -> "sma")
    const baseId = id.split("-")[0];

    try {
      switch (baseId) {
        case "sma": {
          const period = indicator.params.period || 20;
          return calculateSMA(data, period);
        }
        case "ema": {
          const period = indicator.params.period || 20;
          return calculateEMA(data, period);
        }
        case "vwap": {
          return calculateVWAP(data);
        }
        case "rsi": {
          const period = indicator.params.period || 14;
          return calculateRSI(data, period);
        }
        case "macd": {
          const fast = indicator.params.fast || 12;
          const slow = indicator.params.slow || 26;
          const signal = indicator.params.signal || 9;
          const macdData = calculateMACD(data, fast, slow, signal);
          return macdData.macd; // Return MACD line for now
        }
        case "stochastic": {
          const kPeriod = indicator.params.kPeriod || 14;
          const dPeriod = indicator.params.dPeriod || 3;
          const stochData = calculateStochastic(data, kPeriod, dPeriod);
          return stochData.k; // Return %K line for now
        }
        case "atr": {
          const period = indicator.params.period || 14;
          return calculateATR(data, period);
        }
        case "cci": {
          const period = indicator.params.period || 20;
          return calculateCCI(data, period);
        }
        case "williamsR": {
          const period = indicator.params.period || 14;
          return calculateWilliamsR(data, period);
        }
        case "obv": {
          return calculateOBV(data);
        }
        case "mfi": {
          const period = indicator.params.period || 14;
          return calculateMFI(data, period);
        }
        case "bollingerBands": {
          const period = indicator.params.period || 20;
          const stdDev = indicator.params.stdDev || 2;
          return calculateBollingerBands(data, period, stdDev);
        }
        case "keltnerChannels": {
          const period = indicator.params.period || 20;
          const multiplier = indicator.params.multiplier || 2;
          return calculateKeltnerChannels(data, period, multiplier);
        }
        case "donchianChannels": {
          const period = indicator.params.period || 20;
          return calculateDonchianChannels(data, period);
        }
        default:
          return null;
      }
    } catch (error) {
      console.error(`Error calculating ${id}:`, error);
      return null;
    }
  };

  const getIndicatorColor = (baseId: string): string => {
    const base = baseId.split("-")[0];
    const colorPalettes: Record<string, string[]> = {
      sma: ["#2962FF", "#1E88E5", "#1565C0", "#0D47A1", "#0A3D91"],
      ema: ["#FF6D00", "#F57C00", "#E65100", "#BF360C", "#A52A00"],
    };

    if (colorPalettes[base]) {
      const existingCount = activeIndicators.filter((ind) => ind.config.id.startsWith(base)).length;
      return colorPalettes[base][existingCount % colorPalettes[base].length];
    }

    const colors: Record<string, string> = {
      vwap: "#FF9800",
    };

    return colors[base] || colors[baseId] || "#6366f1";
  };

  const handleAddIndicator = (config: IndicatorConfig, customParams?: Record<string, number>) => {
    const params = customParams || config.defaultParams || {};
    const uniqueId =
      config.id === "sma" || config.id === "ema" ? `${config.id}-${params.period}` : config.id;

    if (
      activeIndicators.some(
        (ind) =>
          ind.config.id === config.id && JSON.stringify(ind.params) === JSON.stringify(params)
      )
    ) {
      return;
    }

    const newIndicator: ActiveIndicator = {
      config: { ...config, id: uniqueId, name: `${config.name} (${params.period || ""})` },
      params,
      visible: true,
      color: getIndicatorColor(config.id),
    };
    setActiveIndicators([...activeIndicators, newIndicator]);
  };

  const handleRemoveIndicator = (indicatorId: string) => {
    setActiveIndicators(activeIndicators.filter((ind) => ind.config.id !== indicatorId));
  };

  const handleToggleIndicator = (indicatorId: string) => {
    setActiveIndicators(
      activeIndicators.map((ind) =>
        ind.config.id === indicatorId ? { ...ind, visible: !ind.visible } : ind
      )
    );
  };

  return (
    <div className="rounded-lg border border-border/50 bg-card overflow-hidden">
      <div className="relative h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-card z-20">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">{symbol}</h3>
            <div className="flex items-center gap-1">
              {INTERVALS.map((int) => (
                <button
                  key={int.value}
                  onClick={() => onIntervalChange(int.value)}
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
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded transition-colors",
              sidebarOpen ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
            )}
          >
            <Settings2 className="w-3.5 h-3.5" />
            Indicators
            {activeIndicators.length > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-background/20">
                {activeIndicators.length}
              </span>
            )}
          </button>
        </div>

        {/* Chart Container */}
        <div className="flex-1 relative bg-background">
          <div ref={chartContainerRef} className="absolute inset-0" />

          {/* Sidebar Overlay */}
          <div
            className={cn(
              "absolute top-0 right-0 bottom-0 w-72 bg-card border-l border-border shadow-2xl transition-transform duration-300 ease-in-out z-30",
              sidebarOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <ChartSidebar
              activeIndicators={activeIndicators}
              onAddIndicator={handleAddIndicator}
              onRemoveIndicator={handleRemoveIndicator}
              onToggleIndicator={handleToggleIndicator}
              isOpen={sidebarOpen}
              onToggle={() => setSidebarOpen(false)}
            />
          </div>

          {/* Backdrop */}
          {sidebarOpen && (
            <div
              className="absolute inset-0 bg-black/10 z-20 backdrop-blur-[1px]"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
