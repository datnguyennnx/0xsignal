import { useEffect, useRef } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import type { CandlestickData, HistogramData } from "lightweight-charts";
import { useChartTheme } from "../lib/theme-store";
import { toUtcTimestamps, type UtcDated } from "../lib/time";

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
  colors: { up: string; down: string },
): HistogramData[] =>
  points.map((point) => ({
    time: point.time,
    value: point.volume,
    color: point.close >= point.open ? colors.up : colors.down,
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
  const theme = useChartTheme();
  const initialDataLoadedRef = useRef(false);
  const prevDataLenRef = useRef(0);
  const prevFirstTimeRef = useRef<number | null>(null);
  const prevLastTimeRef = useRef<number | null>(null);
  const prevLastCandleRef = useRef<ChartDataPoint | null>(null);
  const prevIsDarkRef = useRef(isDark);
  const prevThemeVersionRef = useRef(theme.version);
  const stableIdentityRef = useRef<{
    len: number;
    firstTime: number;
    lastTime: number;
    lastClose: number;
    themeVersion: number;
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

    const identity = stableIdentityRef.current;
    if (
      identity &&
      identity.len === data.length &&
      identity.firstTime === currentFirstTime &&
      identity.lastTime === currentLastTime &&
      identity.lastClose === lastPoint.close &&
      identity.themeVersion === theme.version
    ) {
      return;
    }
    stableIdentityRef.current = {
      len: data.length,
      firstTime: currentFirstTime,
      lastTime: currentLastTime,
      lastClose: lastPoint.close,
      themeVersion: theme.version,
    };

    const points = toUtcTimestamps(data);
    const currentLastCandle = points.at(-1);
    if (currentLastCandle === undefined) return;

    const volumeColors = {
      up: theme.colors["--data-up"],
      down: theme.colors["--data-down"],
    };

    const themeChanged = prevThemeVersionRef.current !== theme.version;
    prevThemeVersionRef.current = theme.version;

    if (prevIsDarkRef.current !== isDark) {
      prevIsDarkRef.current = isDark;
      initialDataLoadedRef.current = false;
    }

    if (themeChanged && initialDataLoadedRef.current) {
      candlestickSeries.setData(toCandlestickData(points));
      volumeSeries.setData(toVolumeHistogramData(points, volumeColors));

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

    const prevFirstTime = prevFirstTimeRef.current;
    const prevLastTime = prevLastTimeRef.current;

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
          currentLastCandle.close >= currentLastCandle.open ? volumeColors.up : volumeColors.down,
      });

      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

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
          color: c.close >= c.open ? volumeColors.up : volumeColors.down,
        });
      }

      prevDataLenRef.current = data.length;
      prevFirstTimeRef.current = currentFirstTime;
      prevLastTimeRef.current = currentLastTime;
      prevLastCandleRef.current = { ...currentLastCandle };
      return;
    }

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

    prevDataLenRef.current = data.length;
    prevFirstTimeRef.current = currentFirstTime;
    prevLastTimeRef.current = currentLastTime;
    prevLastCandleRef.current = { ...currentLastCandle };
  }, [data, isDark, theme, candlestickSeries, volumeSeries, chart, visibleCandles]);
  // NOTE: `data` must be in deps because it's the sync trigger.
  // Ref-based guards inside prevent unnecessary LWC API calls on every render.
};
