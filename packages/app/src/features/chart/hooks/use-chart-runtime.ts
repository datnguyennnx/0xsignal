import { useMemo, type RefObject } from "react";
import type { ActiveIndicator, ChartDataPoint } from "@0xsignal/shared";
import { useAppStore } from "@/stores/use-app-store";
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import { usePriceFormat } from "./use-price-format";
import { useChartEngine } from "./use-chart-engine";
import { useChartData } from "./use-chart-data";
import { useIndicatorOverlay } from "./use-indicator-overlay";
import type { IndicatorRenderEntry } from "../utils/indicator-data";

const DESKTOP_CONFIG = {
  visibleCandles: 250,
};

interface UseChartRuntimeParams {
  containerRef: RefObject<HTMLDivElement | null>;
  symbol: string;
  interval: string;
  candles: ChartDataPoint[];
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
  onCrosshairMove: (candle: ChartDataPoint | null) => void;
  activeIndicators: ActiveIndicator[];
  indicatorData: Map<string, IndicatorRenderEntry>;
}

export function useChartRuntime({
  containerRef,
  symbol,
  interval,
  candles,
  hasMore,
  onLoadMore,
  onCrosshairMove,
  activeIndicators,
  indicatorData,
}: UseChartRuntimeParams) {
  const theme = useAppStore((s) => s.theme);
  const systemTheme = useAppStore((s) => s.systemTheme);
  const isDark = (theme === "system" ? systemTheme : theme) === "dark";
  const { getPrecision } = useHyperliquidMeta();
  const precision = useMemo(() => getPrecision(symbol), [symbol, getPrecision]);
  const priceFormat = usePriceFormat(precision.pxDecimals);

  const { chart, candlestickSeries, volumeSeries } = useChartEngine({
    containerRef,
    isDark,
    priceFormat,
    onCrosshairMove,
    onLoadMore,
    hasMore,
  });

  useChartData({
    data: candles,
    isDark,
    candlestickSeries,
    volumeSeries,
    chart,
    visibleCandles: DESKTOP_CONFIG.visibleCandles,
    resetKey: interval,
  });

  useIndicatorOverlay({
    chart,
    mainSeries: candlestickSeries,
    activeIndicators,
    indicatorData,
  });

  return { chart, candlestickSeries, volumeSeries };
}
