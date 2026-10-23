import { useEffect, useRef } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type { CandlestickData, HistogramData } from "lightweight-charts";
import { toRgb } from "../lib/color";
import { toUtcTimestamps, type UtcDated } from "../lib/time";

const readToken = (token: string): string =>
  toRgb(getComputedStyle(document.documentElement).getPropertyValue(token).trim());

const getVolumeColors = (): { gain: string; loss: string } => ({
  gain: readToken("--gain"),
  loss: readToken("--loss"),
});

interface UseChartDataProps {
  data: ChartDataPoint[];
  isDark: boolean;
  candlestickSeries: import("lightweight-charts").ISeriesApi<"Candlestick"> | null;
  volumeSeries: import("lightweight-charts").ISeriesApi<"Histogram"> | null;
  chart: import("lightweight-charts").IChartApi | null;
  visibleCandles: number;
  resetKey?: string; // Force reset when this changes
}

const toCandlestickData = (points: UtcDated<ChartDataPoint>[]): CandlestickData[] =>
  points.map((point) => ({
    time: point.time,
    open: point.open,
    high: point.high,
    low: point.low,
    close: point.close,
  }));

const toVolumeHistogramData = (
  points: UtcDated<ChartDataPoint>[],
  colors: { gain: string; loss: string },
): HistogramData[] =>
  points.map((point) => ({
    time: point.time,
    value: point.volume,
    color: point.close >= point.open ? colors.gain : colors.loss,
  }));

export const useChartData = ({
  data,
  isDark,
  candlestickSeries,
  volumeSeries,
  chart,
  visibleCandles,
  resetKey,
}: UseChartDataProps) => {
  const initialDataLoadedRef = useRef(false);
  const prevDataLenRef = useRef(0);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevLastTimeRef = useRef<number | null>(null);
  const prevLastCandleRef = useRef<ChartDataPoint | null>(null);
  const prevIsDarkRef = useRef(isDark);
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
  }, [resetKey]);

  useEffect(() => {
    if (candlestickSeries === null || volumeSeries === null || data.length === 0) return;

    const currentFirstTime = data[0].time;
    const lastPoint = data.at(-1);
    if (lastPoint === undefined) return;
    const currentLastTime = lastPoint.time;

    // Fast-path: skip full comparison when identity is unchanged
    const identity = stableIdentityRef.current;
    if (
      identity &&
      identity.len === data.length &&
      identity.firstTime === currentFirstTime &&
      identity.lastTime === currentLastTime &&
      identity.lastClose === lastPoint.close
    ) {
      return;
    }
    stableIdentityRef.current = {
      len: data.length,
      firstTime: currentFirstTime,
      lastTime: currentLastTime,
      lastClose: lastPoint.close,
    };

    const points = toUtcTimestamps(data);
    const currentLastCandle = points.at(-1);
    if (currentLastCandle === undefined) return;

    const volumeColors = getVolumeColors();

    if (prevIsDarkRef.current !== isDark) {
      prevIsDarkRef.current = isDark;
      initialDataLoadedRef.current = false;
    }

    const prevFirstTime = prevFirstTimeRef.current;
    const prevLastTime = prevLastTimeRef.current;

    // Case 1: Initial load
    if (!initialDataLoadedRef.current) {
      candlestickSeries.setData(toCandlestickData(points));
      volumeSeries.setData(toVolumeHistogramData(points, volumeColors));

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

      candlestickSeries.setData(toCandlestickData(points));
      volumeSeries.setData(toVolumeHistogramData(points, volumeColors));

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
        time: currentLastCandle.time,
        open: currentLastCandle.open,
        high: currentLastCandle.high,
        low: currentLastCandle.low,
        close: currentLastCandle.close,
      });

      volumeSeries.update({
        time: currentLastCandle.time,
        value: currentLastCandle.volume,
        color:
          currentLastCandle.close >= currentLastCandle.open ? volumeColors.gain : volumeColors.loss,
      });

      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    // Case 4: New candle(s) appended via WS
    if (prevLastTime !== null && currentLastTime > prevLastTime) {
      const startIndex = Math.max(prevDataLenRef.current, 0);
      const newCandles = points.slice(startIndex);

      for (const c of newCandles) {
        candlestickSeries.update({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });

        volumeSeries.update({
          time: c.time,
          value: c.volume,
          color: c.close >= c.open ? volumeColors.gain : volumeColors.loss,
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
      candlestickSeries.setData(toCandlestickData(points));
      volumeSeries.setData(toVolumeHistogramData(points, volumeColors));

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
  }, [data, isDark, candlestickSeries, volumeSeries, chart, visibleCandles]);
  // NOTE: `data` must be in deps because it's the sync trigger.
  // Ref-based guards inside prevent unnecessary LWC API calls on every render.
};
