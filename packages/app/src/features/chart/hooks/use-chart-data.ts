import { useEffect, useRef } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type { CandlestickData, HistogramData, Time } from "lightweight-charts";
const getVolumeColor = (isGain: boolean, isDark: boolean) => {
  if (isGain) return isDark ? "rgba(34, 197, 94, 0.45)" : "rgba(22, 163, 74, 0.4)";
  return isDark ? "rgba(239, 68, 68, 0.45)" : "rgba(220, 38, 38, 0.4)";
};

interface UseChartDataProps {
  data: ChartDataPoint[];
  isDark: boolean;
  candlestickSeries: import("lightweight-charts").ISeriesApi<"Candlestick"> | null;
  volumeSeries: import("lightweight-charts").ISeriesApi<"Histogram"> | null;
  chart: import("lightweight-charts").IChartApi | null;
  visibleCandles: number;
  enabled?: boolean;
  resetKey?: string; // Force reset when this changes
}

const toTime = (time: number): Time => time as Time;

const toCandlestickData = (points: ChartDataPoint[]): CandlestickData<Time>[] =>
  points.map((point) => ({
    time: toTime(point.time),
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
  }));

const toVolumeHistogramData = (points: ChartDataPoint[], isDark: boolean): HistogramData<Time>[] =>
  points.map((point) => ({
    time: toTime(point.time),
    value: point.volume,
    color: getVolumeColor(point.close >= point.open, isDark),
  }));

export const useChartData = ({
  data,
  isDark,
  candlestickSeries,
  volumeSeries,
  chart,
  visibleCandles,
  enabled = true,
  resetKey,
}: UseChartDataProps) => {
  const initialDataLoadedRef = useRef(false);
  const prevDataLenRef = useRef(0);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevLastTimeRef = useRef<number | null>(null);
  const prevLastCandleRef = useRef<ChartDataPoint | null>(null);
  const prevIsDarkRef = useRef(isDark);
  const prevEnabledRef = useRef(enabled);
  const prevResetKeyRef = useRef<string | undefined>(undefined);
  // Fast-path: skip full comparison when data identity is unchanged
  const stableIdentityRef = useRef<{
    len: number;
    firstTime: number;
    lastTime: number;
    lastClose: number;
  } | null>(null);

  useEffect(() => {
    if (resetKey !== undefined) {
      initialDataLoadedRef.current = false;
    }
    prevResetKeyRef.current = resetKey;
  }, [resetKey]);

  useEffect(() => {
    if (!candlestickSeries || !volumeSeries || data.length === 0) return;

    if (!enabled) {
      prevEnabledRef.current = false;
      return;
    }

    const currentFirstTime = data[0].time;
    const currentLastTime = data[data.length - 1].time;
    const currentLastCandle = data[data.length - 1];

    // Fast-path: skip full comparison when identity is unchanged
    const identity = stableIdentityRef.current;
    if (
      identity &&
      identity.len === data.length &&
      identity.firstTime === currentFirstTime &&
      identity.lastTime === currentLastTime &&
      identity.lastClose === currentLastCandle.close
    ) {
      return;
    }
    stableIdentityRef.current = {
      len: data.length,
      firstTime: currentFirstTime,
      lastTime: currentLastTime,
      lastClose: currentLastCandle.close,
    };

    const themeChanged = prevIsDarkRef.current !== isDark;
    const resumedFromDisabled = !prevEnabledRef.current;

    if (themeChanged || resumedFromDisabled) {
      prevIsDarkRef.current = isDark;
      initialDataLoadedRef.current = false;
      prevEnabledRef.current = true;
    }

    const prevFirstTime = prevFirstTimeRef.current;
    const prevLastTime = prevLastTimeRef.current;

    // Case 1: Initial load
    if (!initialDataLoadedRef.current) {
      candlestickSeries.setData(toCandlestickData(data));
      volumeSeries.setData(toVolumeHistogramData(data, isDark));

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
      // Use time-based range — survives data prepend without index shifting
      const visibleRange = timeScale?.getVisibleRange();

      timeScale?.applyOptions({ shiftVisibleRangeOnNewBar: false });

      candlestickSeries.setData(toCandlestickData(data));
      volumeSeries.setData(toVolumeHistogramData(data, isDark));

      if (visibleRange && timeScale) {
        timeScale.setVisibleRange(visibleRange);
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
        time: toTime(currentLastCandle.time),
        open: currentLastCandle.open,
        high: currentLastCandle.high,
        low: currentLastCandle.low,
        close: currentLastCandle.close,
      });

      volumeSeries.update({
        time: toTime(currentLastCandle.time),
        value: currentLastCandle.volume,
        color: getVolumeColor(currentLastCandle.close >= currentLastCandle.open, isDark),
      });

      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 4: New candle(s) appended via WS
    if (prevLastTime !== null && currentLastTime > prevLastTime) {
      const startIndex = Math.max(prevDataLenRef.current, 0);
      const newCandles = data.slice(startIndex);

      for (const c of newCandles) {
        candlestickSeries.update({
          time: toTime(c.time),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });

        volumeSeries.update({
          time: toTime(c.time),
          value: c.volume,
          color: getVolumeColor(c.close >= c.open, isDark),
        });
      }

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 5: Dataset replaced (interval/symbol switch or non-incremental source refresh)
    if (
      prevFirstTime !== null &&
      prevLastTime !== null &&
      (currentFirstTime !== prevFirstTime || currentLastTime !== prevLastTime)
    ) {
      candlestickSeries.setData(toCandlestickData(data));
      volumeSeries.setData(toVolumeHistogramData(data, isDark));

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 6: No meaningful change
    prevDataLenRef.current = data.length;
    prevFirstTimeRef.current = currentFirstTime;
    prevLastTimeRef.current = currentLastTime;
    prevLastCandleRef.current = { ...currentLastCandle };
  }, [data, isDark, candlestickSeries, volumeSeries, chart, visibleCandles, enabled]);
  // NOTE: `data` must be in deps because it's the sync trigger.
  // Ref-based guards inside prevent unnecessary LWC API calls on every render.
};
