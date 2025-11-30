// ICT Overlay - Renders ICT elements on lightweight-charts v5
// Enhanced with labels/tags for better UX

import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { LineSeries } from "lightweight-charts";
import type { ICTAnalysisResult } from "@/core/workers/ict-worker";
import type { ICTVisibility } from "../types";

interface ICTOverlayProps {
  chart: IChartApi | null;
  analysis: ICTAnalysisResult | null;
  visibility: ICTVisibility;
  isDark: boolean;
  lastTime: number;
}

interface ICTSeriesRefs {
  swingLines: ISeriesApi<"Line">[];
  fvgLines: ISeriesApi<"Line">[];
  obLines: ISeriesApi<"Line">[];
  liquidityLines: ISeriesApi<"Line">[];
  oteLines: ISeriesApi<"Line">[];
}

// Ensure data points have unique ascending times
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

export function useICTOverlay({ chart, analysis, visibility, isDark, lastTime }: ICTOverlayProps) {
  const seriesRef = useRef<ICTSeriesRefs>({
    swingLines: [],
    fvgLines: [],
    obLines: [],
    liquidityLines: [],
    oteLines: [],
  });

  const cleanup = useCallback(() => {
    if (!chart) return;
    const refs = seriesRef.current;
    const removeAll = (lines: ISeriesApi<"Line">[]) => {
      lines.forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {}
      });
    };
    removeAll(refs.swingLines);
    removeAll(refs.fvgLines);
    removeAll(refs.obLines);
    removeAll(refs.liquidityLines);
    removeAll(refs.oteLines);
    refs.swingLines = [];
    refs.fvgLines = [];
    refs.obLines = [];
    refs.liquidityLines = [];
    refs.oteLines = [];
  }, [chart]);

  // Render market structure with labels
  const renderMarketStructure = useCallback(() => {
    if (!chart || !analysis?.marketStructure) return;
    const { swings, events } = analysis.marketStructure;
    if (swings.length < 2) return;

    const swingLines: ISeriesApi<"Line">[] = [];

    // Main swing zigzag
    const swingLine = chart.addSeries(LineSeries, {
      color: isDark ? "#71717a" : "#a8a29e",
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: "MS", // Market Structure
    });

    const lineData = ensureUniqueAscending(swings.map((s) => ({ time: s.time, value: s.price })));
    if (lineData.length >= 2) {
      swingLine.setData(lineData);
      swingLines.push(swingLine);
    }

    // BOS/ChoCH lines with labels
    for (const event of events.slice(-5)) {
      const isBullish = event.direction === "bullish";
      const isChoCH = event.type === "ChoCH";

      const color = isChoCH
        ? isBullish
          ? isDark
            ? "#22c55e"
            : "#16a34a"
          : isDark
            ? "#ef4444"
            : "#dc2626"
        : isDark
          ? "#a1a1aa"
          : "#78716c";

      // Label includes type and direction
      const label = `${event.type} ${isBullish ? "↑" : "↓"}`;

      const eventLine = chart.addSeries(LineSeries, {
        color,
        lineWidth: isChoCH ? 2 : 1,
        lineStyle: isChoCH ? 0 : 3,
        lastValueVisible: true, // Show price on scale
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: label,
      });

      const eventData = ensureUniqueAscending([
        { time: event.time, value: event.price },
        { time: lastTime, value: event.price },
      ]);

      if (eventData.length >= 2) {
        eventLine.setData(eventData);
        swingLines.push(eventLine);
      }
    }

    seriesRef.current.swingLines = swingLines;
  }, [chart, analysis, isDark, lastTime]);

  // Render FVGs with labels
  const renderFVGs = useCallback(() => {
    if (!chart || !analysis?.fvgs.length) return;

    const fvgLines: ISeriesApi<"Line">[] = [];
    const recentFVGs = analysis.fvgs.filter((f) => !f.filled).slice(-6);

    for (let i = 0; i < recentFVGs.length; i++) {
      const fvg = recentFVGs[i];
      const isBullish = fvg.type === "bullish";

      const color = isBullish
        ? isDark
          ? "rgba(34, 197, 94, 0.7)"
          : "rgba(22, 163, 74, 0.7)"
        : isDark
          ? "rgba(239, 68, 68, 0.7)"
          : "rgba(220, 38, 38, 0.7)";

      const labelPrefix = isBullish ? "FVG+" : "FVG-";

      // Upper boundary with label
      const upperLine = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 0,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: `${labelPrefix} H`,
      });

      // Lower boundary
      const lowerLine = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: `${labelPrefix} L`,
      });

      // Midpoint (CE - Consequent Encroachment)
      const midLine = chart.addSeries(LineSeries, {
        color: isDark ? "rgba(161, 161, 170, 0.5)" : "rgba(120, 113, 108, 0.5)",
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: "CE",
      });

      const upperData = ensureUniqueAscending([
        { time: fvg.startTime, value: fvg.high },
        { time: lastTime, value: fvg.high },
      ]);
      const lowerData = ensureUniqueAscending([
        { time: fvg.startTime, value: fvg.low },
        { time: lastTime, value: fvg.low },
      ]);
      const midData = ensureUniqueAscending([
        { time: fvg.startTime, value: fvg.midpoint },
        { time: lastTime, value: fvg.midpoint },
      ]);

      if (upperData.length >= 2) {
        upperLine.setData(upperData);
        fvgLines.push(upperLine);
      }
      if (lowerData.length >= 2) {
        lowerLine.setData(lowerData);
        fvgLines.push(lowerLine);
      }
      if (midData.length >= 2) {
        midLine.setData(midData);
        fvgLines.push(midLine);
      }
    }

    seriesRef.current.fvgLines = fvgLines;
  }, [chart, analysis, isDark, lastTime]);

  // Render Order Blocks with labels
  const renderOrderBlocks = useCallback(() => {
    if (!chart || !analysis?.orderBlocks.length) return;

    const obLines: ISeriesApi<"Line">[] = [];
    const activeOBs = analysis.orderBlocks.filter((ob) => !ob.mitigated).slice(-4);

    for (const ob of activeOBs) {
      const isBullish = ob.type === "bullish";

      const color = isBullish
        ? isDark
          ? "rgba(34, 197, 94, 0.8)"
          : "rgba(22, 163, 74, 0.8)"
        : isDark
          ? "rgba(239, 68, 68, 0.8)"
          : "rgba(220, 38, 38, 0.8)";

      const label = isBullish ? "OB+ (Demand)" : "OB- (Supply)";

      // High line with label
      const highLine = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: 0,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: label,
      });

      // Low line
      const lowLine = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        lineStyle: 0,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
      });

      const highData = ensureUniqueAscending([
        { time: ob.time, value: ob.high },
        { time: lastTime, value: ob.high },
      ]);
      const lowData = ensureUniqueAscending([
        { time: ob.time, value: ob.low },
        { time: lastTime, value: ob.low },
      ]);

      if (highData.length >= 2) {
        highLine.setData(highData);
        obLines.push(highLine);
      }
      if (lowData.length >= 2) {
        lowLine.setData(lowData);
        obLines.push(lowLine);
      }
    }

    seriesRef.current.obLines = obLines;
  }, [chart, analysis, isDark, lastTime]);

  // Render Liquidity Zones with labels
  const renderLiquidityZones = useCallback(() => {
    if (!chart || !analysis?.liquidityZones.length) return;

    const liquidityLines: ISeriesApi<"Line">[] = [];
    const activeZones = analysis.liquidityZones.filter((z) => !z.swept).slice(-4);

    for (const zone of activeZones) {
      const isBSL = zone.type === "BSL";

      const color = isBSL
        ? isDark
          ? "rgba(34, 197, 94, 0.6)"
          : "rgba(22, 163, 74, 0.6)"
        : isDark
          ? "rgba(239, 68, 68, 0.6)"
          : "rgba(220, 38, 38, 0.6)";

      // Label with touch count
      const label = `${zone.type} (${zone.touchCount}x)`;

      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 3, // Dotted
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: label,
      });

      const lineData = ensureUniqueAscending([
        { time: zone.startTime, value: zone.price },
        { time: lastTime, value: zone.price },
      ]);

      if (lineData.length >= 2) {
        line.setData(lineData);
        liquidityLines.push(line);
      }
    }

    seriesRef.current.liquidityLines = liquidityLines;
  }, [chart, analysis, isDark, lastTime]);

  // Render OTE Zones with Fibonacci labels
  const renderOTEZones = useCallback(() => {
    if (!chart || !analysis?.oteZones.length) return;

    const oteLines: ISeriesApi<"Line">[] = [];
    const recentOTEs = analysis.oteZones.slice(-2);

    for (const ote of recentOTEs) {
      const color = isDark ? "rgba(245, 158, 11, 0.6)" : "rgba(217, 119, 6, 0.6)";
      const mutedColor = isDark ? "rgba(161, 161, 170, 0.4)" : "rgba(120, 113, 108, 0.4)";

      // 0.618 level (Golden Pocket top)
      const line618 = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: "OTE 0.618",
      });

      // 0.786 level (Golden Pocket bottom)
      const line786 = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 2,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: "OTE 0.786",
      });

      // 0.5 level (Equilibrium)
      const line50 = chart.addSeries(LineSeries, {
        color: mutedColor,
        lineWidth: 1,
        lineStyle: 3,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: "EQ 0.5",
      });

      // 0.382 level
      const line382 = chart.addSeries(LineSeries, {
        color: mutedColor,
        lineWidth: 1,
        lineStyle: 3,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
        title: "0.382",
      });

      const data618 = ensureUniqueAscending([
        { time: ote.startTime, value: ote.goldenPocketHigh },
        { time: ote.endTime, value: ote.goldenPocketHigh },
      ]);
      const data786 = ensureUniqueAscending([
        { time: ote.startTime, value: ote.goldenPocketLow },
        { time: ote.endTime, value: ote.goldenPocketLow },
      ]);
      const data50 = ensureUniqueAscending([
        { time: ote.startTime, value: ote.fibLevels["0.5"] },
        { time: ote.endTime, value: ote.fibLevels["0.5"] },
      ]);
      const data382 = ensureUniqueAscending([
        { time: ote.startTime, value: ote.fibLevels["0.382"] },
        { time: ote.endTime, value: ote.fibLevels["0.382"] },
      ]);

      if (data618.length >= 2) {
        line618.setData(data618);
        oteLines.push(line618);
      }
      if (data786.length >= 2) {
        line786.setData(data786);
        oteLines.push(line786);
      }
      if (data50.length >= 2) {
        line50.setData(data50);
        oteLines.push(line50);
      }
      if (data382.length >= 2) {
        line382.setData(data382);
        oteLines.push(line382);
      }
    }

    seriesRef.current.oteLines = oteLines;
  }, [chart, analysis, isDark]);

  // Main render effect
  useEffect(() => {
    cleanup();
    if (!chart || !analysis) return;

    if (visibility.marketStructure) renderMarketStructure();
    if (visibility.fvg) renderFVGs();
    if (visibility.orderBlocks) renderOrderBlocks();
    if (visibility.liquidity) renderLiquidityZones();
    if (visibility.ote) renderOTEZones();

    return cleanup;
  }, [
    chart,
    analysis,
    visibility,
    cleanup,
    renderMarketStructure,
    renderFVGs,
    renderOrderBlocks,
    renderLiquidityZones,
    renderOTEZones,
  ]);

  return { cleanup };
}
