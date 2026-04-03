/**
 * @overview Wyckoff Method Chart Overlay Hook
 *
 * Manages the rendering of Wyckoff Method annotations (Phases, Trading Ranges, Efforts, Events)
 * using a combination of LW-Charts Series (Line) and custom Primitives (Zone).
 *
 * @mechanism
 * - utilizes ZonePrimitive to render shaded background areas for Phases and Ranges.
 * - utilizes LineSeries to render horizontal price levels for SC/BC and Effort/Result divergences.
 * - implements a strict cleanup cycle (attach/detach/removeSeries) to prevent memory leaks and ghost primitives.
 */
import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { LineSeries } from "lightweight-charts";
import type { WyckoffAnalysis } from "@0xsignal/shared";
import type { WyckoffVisibility } from "../types";
import { ZonePrimitive } from "../../ict/primitives";
import { getWyckoffColors } from "../utils";
import { ensureUniqueAscending } from "../../utils/ensure-unique-ascending";

interface WyckoffOverlayProps {
  chart: IChartApi | null;
  series?: ISeriesApi<"Candlestick"> | null;
  analysis: WyckoffAnalysis | null;
  visibility: WyckoffVisibility;
  lastTime: number;
}

interface WyckoffRefs {
  rangePrimitive: ZonePrimitive | null;
  phasePrimitives: ZonePrimitive[];
  effortLines: ISeriesApi<"Line">[];
  climaxLines: ISeriesApi<"Line">[];
  eventLines: ISeriesApi<"Line">[];
}

const getPhaseColor = (phase: string): { fill: string; border: string } => {
  const map: Record<string, { fill: string; border: string }> = {
    A: { fill: "var(--phase-fill-a)", border: "var(--phase-border-a)" },
    B: { fill: "var(--phase-fill-b)", border: "var(--phase-border-b)" },
    C: { fill: "var(--phase-fill-c)", border: "var(--phase-border-c)" },
    D: { fill: "var(--phase-fill-d)", border: "var(--phase-border-d)" },
    E: { fill: "var(--phase-fill-e)", border: "var(--phase-border-e)" },
  };
  return map[phase] || map.A;
};

export function useWyckoffOverlay({
  chart,
  series,
  analysis,
  visibility,
  lastTime,
}: WyckoffOverlayProps) {
  const refs = useRef<WyckoffRefs>({
    rangePrimitive: null,
    phasePrimitives: [],
    effortLines: [],
    climaxLines: [],
    eventLines: [],
  });

  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    seriesRef.current = series ?? null;
  }, [series]);

  const appliedKeysRef = useRef({
    phases: "",
    effort: "",
    tradingRange: "",
    climaxes: "",
    events: "",
  });

  const cleanup = useCallback(() => {
    if (!chart) return;
    const r = refs.current;

    r.effortLines.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });
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
    if (s) {
      r.phasePrimitives.forEach((primitive) => {
        try {
          s.detachPrimitive(primitive);
        } catch {}
      });
      if (r.rangePrimitive) {
        try {
          s.detachPrimitive(r.rangePrimitive);
        } catch {}
      }
    }

    r.rangePrimitive = null;
    r.phasePrimitives = [];
    r.effortLines = [];
    r.climaxLines = [];
    r.eventLines = [];

    appliedKeysRef.current = {
      phases: "",
      effort: "",
      tradingRange: "",
      climaxes: "",
      events: "",
    };
  }, [chart]);

  const renderPhases = useCallback(() => {
    if (!chart || !analysis?.phases.length || !seriesRef.current) return;
    const key = `phases-${analysis.phases.length}-${lastTime}`;
    if (appliedKeysRef.current.phases === key) return;

    const s = seriesRef.current;
    refs.current.phasePrimitives.forEach((p) => {
      try {
        s.detachPrimitive(p);
      } catch {}
    });

    const primitives: ZonePrimitive[] = [];
    for (const phase of analysis.phases) {
      const phaseColors = getPhaseColor(phase.phase);
      const cycleLabel = phase.cycle.charAt(0).toUpperCase() + phase.cycle.slice(1).slice(0, 4);

      const primitive = new ZonePrimitive({
        startTime: phase.startTime,
        endTime:
          phase.endIndex > 0 ? (analysis.events[phase.endIndex]?.time ?? lastTime) : lastTime,
        highPrice: 0,
        lowPrice: 0,
        fillColor: phaseColors.fill,
        borderColor: phaseColors.border,
        borderWidth: 2,
        label: `Phase ${phase.phase} (${cycleLabel})`,
        showMidline: false,
      });

      s.attachPrimitive(primitive);
      primitives.push(primitive);
    }
    refs.current.phasePrimitives = primitives;
    appliedKeysRef.current.phases = key;
  }, [chart, analysis, lastTime]);

  const renderEffortResults = useCallback(() => {
    if (!chart || !analysis?.effortResults.length) return;
    const key = `effort-${analysis.effortResults.length}-${lastTime}`;
    if (appliedKeysRef.current.effort === key) return;

    refs.current.effortLines.forEach((l) => {
      try {
        chart.removeSeries(l);
      } catch {}
    });

    const colors = getWyckoffColors();
    const lines: ISeriesApi<"Line">[] = [];

    for (const effort of analysis.effortResults.slice(-6)) {
      let color: string;
      let label: string;

      switch (effort.divergence) {
        case "bullish":
          color = colors.effort?.bullish ?? "var(--effort-bullish)";
          label = "Effort+";
          break;
        case "bearish":
          color = colors.effort?.bearish ?? "var(--effort-bearish)";
          label = "Effort-";
          break;
        default:
          color = colors.effort?.neutral ?? "var(--effort-neutral)";
          label = "Effort~";
      }

      const lineWidth = effort.divergence === "neutral" ? 1 : 2;
      const lineStyle = effort.divergence === "neutral" ? 2 : 0;

      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth,
        lineStyle,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: label,
      });

      const lineData = ensureUniqueAscending([
        { time: effort.time, value: effort.effort },
        { time: lastTime, value: effort.effort },
      ]);

      if (lineData.length >= 2) {
        line.setData(lineData);
        lines.push(line);
      }

      if (Math.abs(effort.effort - effort.result) > effort.effort * 0.1) {
        const resultLine = chart.addSeries(LineSeries, {
          color: colors.effort?.result ?? "var(--effort-result)",
          lineWidth: 1,
          lineStyle: 3,
          lastValueVisible: false,
          priceLineVisible: false,
          title: `${label} Result`,
        });
        const resultData = ensureUniqueAscending([
          { time: effort.time, value: effort.result },
          { time: lastTime, value: effort.result },
        ]);
        if (resultData.length >= 2) {
          resultLine.setData(resultData);
          lines.push(resultLine);
        }
      }
    }
    refs.current.effortLines = lines;
    appliedKeysRef.current.effort = key;
  }, [chart, analysis, lastTime]);

  const renderTradingRange = useCallback(() => {
    if (!chart || !analysis?.tradingRange || !seriesRef.current) return;
    const key = `tr-${analysis.tradingRange.startTime}-${analysis.tradingRange.high}-${lastTime}`;
    if (appliedKeysRef.current.tradingRange === key) return;

    const s = seriesRef.current;
    if (refs.current.rangePrimitive) {
      try {
        s.detachPrimitive(refs.current.rangePrimitive);
      } catch {}
    }

    const colors = getWyckoffColors();
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

    s.attachPrimitive(primitive);
    refs.current.rangePrimitive = primitive;
    appliedKeysRef.current.tradingRange = key;
  }, [chart, analysis, lastTime]);

  const renderClimaxes = useCallback(() => {
    if (!chart || !analysis?.climaxes.length) return;
    const key = `climax-${analysis.climaxes.length}-${lastTime}`;
    if (appliedKeysRef.current.climaxes === key) return;

    refs.current.climaxLines.forEach((l) => {
      try {
        chart.removeSeries(l);
      } catch {}
    });

    const colors = getWyckoffColors();
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
    appliedKeysRef.current.climaxes = key;
  }, [chart, analysis, lastTime]);

  const renderEvents = useCallback(() => {
    if (!chart || !analysis?.events.length) return;
    const key = `events-${analysis.events.length}-${lastTime}`;
    if (appliedKeysRef.current.events === key) return;

    refs.current.eventLines.forEach((l) => {
      try {
        chart.removeSeries(l);
      } catch {}
    });

    const colors = getWyckoffColors();
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
    appliedKeysRef.current.events = key;
  }, [chart, analysis, lastTime]);

  useEffect(() => {
    if (!chart || !analysis) {
      cleanup();
      return;
    }

    if (visibility.phases) renderPhases();
    else {
      const s = seriesRef.current;
      if (s)
        refs.current.phasePrimitives.forEach((p) => {
          try {
            s.detachPrimitive(p);
          } catch {}
        });
      refs.current.phasePrimitives = [];
      appliedKeysRef.current.phases = "";
    }

    if (visibility.effortResult) renderEffortResults();
    else {
      refs.current.effortLines.forEach((l) => {
        try {
          chart.removeSeries(l);
        } catch {}
      });
      refs.current.effortLines = [];
      appliedKeysRef.current.effort = "";
    }

    if (visibility.tradingRange) renderTradingRange();
    else {
      const s = seriesRef.current;
      if (s && refs.current.rangePrimitive) {
        try {
          s.detachPrimitive(refs.current.rangePrimitive);
        } catch {}
      }
      refs.current.rangePrimitive = null;
      appliedKeysRef.current.tradingRange = "";
    }

    if (visibility.climaxes) renderClimaxes();
    else {
      refs.current.climaxLines.forEach((l) => {
        try {
          chart.removeSeries(l);
        } catch {}
      });
      refs.current.climaxLines = [];
      appliedKeysRef.current.climaxes = "";
    }

    if (visibility.springs) renderEvents();
    else {
      refs.current.eventLines.forEach((l) => {
        try {
          chart.removeSeries(l);
        } catch {}
      });
      refs.current.eventLines = [];
      appliedKeysRef.current.events = "";
    }

    return cleanup;
  }, [
    chart,
    analysis,
    visibility,
    renderPhases,
    renderEffortResults,
    renderTradingRange,
    renderClimaxes,
    renderEvents,
    cleanup,
  ]);
  return { cleanup };
}
