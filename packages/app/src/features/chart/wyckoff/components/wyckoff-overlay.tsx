import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { LineSeries } from "lightweight-charts";
import type { WyckoffAnalysisResult } from "@/core/workers/wyckoff-worker";
import type { WyckoffVisibility } from "../types";
import { ZonePrimitive } from "../../ict/primitives";
import { getWyckoffColors } from "../utils";

interface WyckoffOverlayProps {
  chart: IChartApi | null;
  series?: ISeriesApi<"Candlestick"> | null;
  analysis: WyckoffAnalysisResult | null;
  visibility: WyckoffVisibility;
  isDark: boolean;
  lastTime: number;
}

interface WyckoffRefs {
  rangePrimitive: ZonePrimitive | null;
  climaxLines: ISeriesApi<"Line">[];
  eventLines: ISeriesApi<"Line">[];
}

const ensureUniqueAscending = (
  points: { time: number; value: number }[]
): { time: Time; value: number }[] => {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const uniqueMap = new Map<number, number>();
  for (const p of sorted) {
    uniqueMap.set(p.time, p.value);
  }
  return Array.from(uniqueMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([time, value]) => ({ time: time as Time, value }));
};

export function useWyckoffOverlay({
  chart,
  series,
  analysis,
  visibility,
  isDark,
  lastTime,
}: WyckoffOverlayProps) {
  const refs = useRef<WyckoffRefs>({
    rangePrimitive: null,
    climaxLines: [],
    eventLines: [],
  });

  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    seriesRef.current = series ?? null;
  }, [series]);

  const cleanup = useCallback(() => {
    if (!chart) return;
    const r = refs.current;

    r.climaxLines.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });
    r.eventLines.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });

    const s = seriesRef.current;
    if (s && r.rangePrimitive) {
      try {
        s.detachPrimitive(r.rangePrimitive);
      } catch {}
    }

    r.rangePrimitive = null;
    r.climaxLines = [];
    r.eventLines = [];
  }, [chart]);

  const renderTradingRange = useCallback(() => {
    if (!chart || !analysis?.tradingRange || !seriesRef.current) return;

    const colors = getWyckoffColors(isDark);
    const tr = analysis.tradingRange;

    const primitive = new ZonePrimitive({
      startTime: tr.startTime,
      endTime: lastTime,
      highPrice: tr.high,
      lowPrice: tr.low,
      fillColor: colors.tradingRange.fill,
      borderColor: colors.tradingRange.border,
      borderWidth: 1,
      label: `TR ${analysis.cycle.toUpperCase()}`,
      showMidline: true,
      midlineColor: colors.tradingRange.border,
    });

    seriesRef.current.attachPrimitive(primitive);
    refs.current.rangePrimitive = primitive;
  }, [chart, analysis, isDark, lastTime]);

  const renderClimaxes = useCallback(() => {
    if (!chart || !analysis?.climaxes.length) return;

    const colors = getWyckoffColors(isDark);
    const lines: ISeriesApi<"Line">[] = [];

    for (const climax of analysis.climaxes) {
      const color = climax.type === "SC" ? colors.climax.sc : colors.climax.bc;
      const label = climax.type === "SC" ? "SC" : "BC";

      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: 0,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: label,
      });

      const lineData = ensureUniqueAscending([
        { time: climax.time, value: climax.price },
        { time: lastTime, value: climax.price },
      ]);

      if (lineData.length >= 2) {
        line.setData(lineData);
        lines.push(line);
      }
    }

    refs.current.climaxLines = lines;
  }, [chart, analysis, isDark, lastTime]);

  const renderEvents = useCallback(() => {
    if (!chart || !analysis?.events.length) return;

    const colors = getWyckoffColors(isDark);
    const lines: ISeriesApi<"Line">[] = [];

    for (const event of analysis.events.slice(-8)) {
      let color: string;
      switch (event.type) {
        case "spring":
          color = colors.event.spring;
          break;
        case "upthrust":
          color = colors.event.upthrust;
          break;
        case "LPS":
          color = colors.event.lps;
          break;
        case "LPSY":
          color = colors.event.lpsy;
          break;
        case "SOS":
          color = colors.event.sos;
          break;
        case "SOW":
          color = colors.event.sow;
          break;
        default:
          color = colors.event.st;
      }

      const lineWidth = event.significance === "high" ? 2 : 1;
      const lineStyle = event.type === "ST" ? 2 : 0;

      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        lineStyle,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: event.type,
      });

      const lineData = ensureUniqueAscending([
        { time: event.time, value: event.price },
        { time: lastTime, value: event.price },
      ]);

      if (lineData.length >= 2) {
        line.setData(lineData);
        lines.push(line);
      }
    }

    refs.current.eventLines = lines;
  }, [chart, analysis, isDark, lastTime]);

  useEffect(() => {
    cleanup();
    if (!chart || !analysis) return;

    if (visibility.tradingRange) renderTradingRange();
    if (visibility.climaxes) renderClimaxes();
    if (visibility.springs) renderEvents();

    return cleanup;
  }, [chart, analysis, visibility, cleanup, renderTradingRange, renderClimaxes, renderEvents]);

  return { cleanup };
}
