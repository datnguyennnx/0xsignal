/**
 * @fileoverview Chart Data Manager
 *
 * Handles efficient data updates to lightweight-charts.
 *
 * @update-strategies
 * - Initial: setData with full history
 * - Prepend: setData when loading older candles
 * - Update: update() same candle
 * - Append: update() new candle
 *
 * @performance
 * - Tracks previous state to determine update type
 * - Avoids full re-render on each tick
 * - Handles theme/interval changes
 */
import { useEffect, useRef } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type { Time } from "lightweight-charts";
import { getVolumeColor } from "@/core/utils/colors";

interface UseChartDataProps {
  data: ChartDataPoint[];
  isDark: boolean;
  interval: string;
  symbol: string;
  candlestickSeries: import("lightweight-charts").ISeriesApi<"Candlestick"> | null;
  volumeSeries: import("lightweight-charts").ISeriesApi<"Histogram"> | null;
  chart: import("lightweight-charts").IChartApi | null;
  visibleCandles: number;
}

export const useChartData = ({
  data,
  isDark,
  interval,
  symbol,
  candlestickSeries,
  volumeSeries,
  chart,
  visibleCandles,
}: UseChartDataProps) => {
  const initialDataLoadedRef = useRef(false);
  const prevDataLenRef = useRef(0);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevLastTimeRef = useRef<number | null>(null);
  const prevLastCandleRef = useRef<ChartDataPoint | null>(null);
  const prevIsDarkRef = useRef(isDark);
  const prevIntervalRef = useRef(interval);
  const prevSymbolRef = useRef(symbol);

  useEffect(() => {
    if (!candlestickSeries || !volumeSeries || data.length === 0) return;

    const themeChanged = prevIsDarkRef.current !== isDark;
    const intervalChanged = prevIntervalRef.current !== interval;
    const symbolChanged = prevSymbolRef.current !== symbol;

    if (themeChanged || intervalChanged || symbolChanged) {
      prevIsDarkRef.current = isDark;
      prevIntervalRef.current = interval;
      prevSymbolRef.current = symbol;
      initialDataLoadedRef.current = false;
    }

    const currentFirstTime = data[0].time;
    const currentLastTime = data[data.length - 1].time;
    const currentLastCandle = data[data.length - 1];
    const prevFirstTime = prevFirstTimeRef.current;
    const prevLastTime = prevLastTimeRef.current;

    // Case 1: Initial load
    if (!initialDataLoadedRef.current) {
      candlestickSeries.setData(data as unknown as { time: Time }[]);
      volumeSeries.setData(
        data.map((d) => ({
          time: d.time as Time,
          value: d.volume,
          color: getVolumeColor(d.close >= d.open, isDark),
        }))
      );

      const dataLen = data.length;
      const fromIndex = Math.max(dataLen - visibleCandles, 0);
      chart?.timeScale().setVisibleLogicalRange({ from: fromIndex, to: dataLen });
      initialDataLoadedRef.current = true;

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 2: Historical data prepended (loadMore)
    if (prevFirstTime !== null && currentFirstTime < prevFirstTime) {
      const timeScale = chart?.timeScale();
      const visibleRange = timeScale?.getVisibleLogicalRange();

      timeScale?.applyOptions({ shiftVisibleRangeOnNewBar: false });

      candlestickSeries.setData(data as unknown as { time: Time }[]);
      volumeSeries.setData(
        data.map((d) => ({
          time: d.time as Time,
          value: d.volume,
          color: getVolumeColor(d.close >= d.open, isDark),
        }))
      );

      if (visibleRange && timeScale) {
        const barsDiff = data.length - prevDataLenRef.current;
        timeScale.setVisibleLogicalRange({
          from: visibleRange.from + barsDiff,
          to: visibleRange.to + barsDiff,
        });
      }

      timeScale?.applyOptions({ shiftVisibleRangeOnNewBar: true });

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 3: Real-time update on same last candle
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
      candlestickSeries.update({
        time: currentLastCandle.time as Time,
        open: currentLastCandle.open,
        high: currentLastCandle.high,
        low: currentLastCandle.low,
        close: currentLastCandle.close,
      });

      volumeSeries.update({
        time: currentLastCandle.time as Time,
        value: currentLastCandle.volume,
        color: getVolumeColor(currentLastCandle.close >= currentLastCandle.open, isDark),
      });

      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 4: New candle(s) appended via WS
    if (prevLastTime !== null && currentLastTime >= prevLastTime) {
      const newCandles = data.filter((d) => d.time >= prevLastTime!);

      newCandles.forEach((c) => {
        candlestickSeries.update({
          time: c.time as Time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });

        volumeSeries.update({
          time: c.time as Time,
          value: c.volume,
          color: getVolumeColor(c.close >= c.open, isDark),
        });
      });

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 5: No meaningful change
    prevDataLenRef.current = data.length;
    prevFirstTimeRef.current = currentFirstTime;
    prevLastTimeRef.current = currentLastTime;
    prevLastCandleRef.current = { ...currentLastCandle };
  }, [data, isDark, interval, symbol, candlestickSeries, volumeSeries, chart, visibleCandles]);
};
