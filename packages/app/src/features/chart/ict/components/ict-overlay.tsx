import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";
import { LineSeries } from "lightweight-charts";
import type { ICTAnalysisResult } from "@/core/workers/ict-worker";
import type { ICTVisibility } from "../types";
import { ZonePrimitive } from "../primitives";
import { BandPrimitive } from "../primitives";
import { getICTColors } from "../utils";

interface ICTOverlayProps {
  chart: IChartApi | null;
  series?: ISeriesApi<"Candlestick"> | null;
  analysis: ICTAnalysisResult | null;
  visibility: ICTVisibility;
  isDark: boolean;
  lastTime: number;
}

interface ICTRefs {
  swingLines: ISeriesApi<"Line">[];
  fvgPrimitives: ZonePrimitive[];
  obPrimitives: ZonePrimitive[];
  liquidityLines: ISeriesApi<"Line">[];
  otePrimitives: BandPrimitive[];
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

export function useICTOverlay({
  chart,
  series,
  analysis,
  visibility,
  isDark,
  lastTime,
}: ICTOverlayProps) {
  const refs = useRef<ICTRefs>({
    swingLines: [],
    fvgPrimitives: [],
    obPrimitives: [],
    liquidityLines: [],
    otePrimitives: [],
  });

  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  useEffect(() => {
    seriesRef.current = series ?? null;
  }, [series]);

  const cleanup = useCallback(() => {
    if (!chart) return;
    const r = refs.current;

    r.swingLines.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });
    r.liquidityLines.forEach((s) => {
      try {
        chart.removeSeries(s);
      } catch {}
    });

    const s = seriesRef.current;
    if (s) {
      r.fvgPrimitives.forEach((p) => {
        try {
          s.detachPrimitive(p);
        } catch {}
      });
      r.obPrimitives.forEach((p) => {
        try {
          s.detachPrimitive(p);
        } catch {}
      });
      r.otePrimitives.forEach((p) => {
        try {
          s.detachPrimitive(p);
        } catch {}
      });
    }

    r.swingLines = [];
    r.fvgPrimitives = [];
    r.obPrimitives = [];
    r.liquidityLines = [];
    r.otePrimitives = [];
  }, [chart]);

  const renderMarketStructure = useCallback(() => {
    if (!chart || !analysis?.marketStructure) return;
    const { swings, events } = analysis.marketStructure;
    if (swings.length < 2) return;

    const colors = getICTColors(isDark);
    const lines: ISeriesApi<"Line">[] = [];

    const swingLine = chart.addSeries(LineSeries, {
      color: colors.structure.swing,
      lineWidth: 1,
      lineStyle: 2,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      title: "MS",
    });

    const lineData = ensureUniqueAscending(swings.map((s) => ({ time: s.time, value: s.price })));
    if (lineData.length >= 2) {
      swingLine.setData(lineData);
      lines.push(swingLine);
    }

    for (const event of events.slice(-5)) {
      const isBullish = event.direction === "bullish";
      const isChoCH = event.type === "ChoCH";
      const color = isChoCH
        ? isBullish
          ? colors.structure.choch.bullish
          : colors.structure.choch.bearish
        : colors.structure.bos;

      const eventLine = chart.addSeries(LineSeries, {
        color,
        lineWidth: isChoCH ? 2 : 1,
        lineStyle: isChoCH ? 0 : 3,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: `${event.type} ${isBullish ? "+" : "-"}`,
      });

      const eventData = ensureUniqueAscending([
        { time: event.time, value: event.price },
        { time: lastTime, value: event.price },
      ]);

      if (eventData.length >= 2) {
        eventLine.setData(eventData);
        lines.push(eventLine);
      }
    }

    refs.current.swingLines = lines;
  }, [chart, analysis, isDark, lastTime]);

  const renderFVGs = useCallback(() => {
    if (!chart || !analysis?.fvgs.length || !seriesRef.current) return;

    const colors = getICTColors(isDark);
    const primitives: ZonePrimitive[] = [];
    const recentFVGs = analysis.fvgs.filter((f) => !f.filled).slice(-6);

    for (const fvg of recentFVGs) {
      const isBullish = fvg.type === "bullish";
      const palette = isBullish ? colors.fvgBullish : colors.fvgBearish;

      const primitive = new ZonePrimitive({
        startTime: fvg.startTime,
        endTime: lastTime,
        highPrice: fvg.high,
        lowPrice: fvg.low,
        fillColor: palette.fill,
        borderColor: palette.border,
        borderWidth: 1,
        label: isBullish ? "FVG+" : "FVG-",
        showMidline: true,
        midlineColor: palette.mid,
      });

      seriesRef.current.attachPrimitive(primitive);
      primitives.push(primitive);
    }

    refs.current.fvgPrimitives = primitives;
  }, [chart, analysis, isDark, lastTime]);

  const renderOrderBlocks = useCallback(() => {
    if (!chart || !analysis?.orderBlocks.length || !seriesRef.current) return;

    const colors = getICTColors(isDark);
    const primitives: ZonePrimitive[] = [];
    const activeOBs = analysis.orderBlocks.filter((ob) => !ob.mitigated).slice(-4);

    for (const ob of activeOBs) {
      const isBullish = ob.type === "bullish";
      const palette = isBullish ? colors.obBullish : colors.obBearish;

      const primitive = new ZonePrimitive({
        startTime: ob.time,
        endTime: lastTime,
        highPrice: ob.high,
        lowPrice: ob.low,
        fillColor: palette.fill,
        borderColor: palette.border,
        borderWidth: 2,
        label: isBullish ? "OB+" : "OB-",
      });

      seriesRef.current.attachPrimitive(primitive);
      primitives.push(primitive);
    }

    refs.current.obPrimitives = primitives;
  }, [chart, analysis, isDark, lastTime]);

  const renderLiquidityZones = useCallback(() => {
    if (!chart || !analysis?.liquidityZones.length) return;

    const colors = getICTColors(isDark);
    const lines: ISeriesApi<"Line">[] = [];
    const activeZones = analysis.liquidityZones.filter((z) => !z.swept).slice(-4);

    for (const zone of activeZones) {
      const isBSL = zone.type === "BSL";
      const color = isBSL ? colors.liquidity.bsl : colors.liquidity.ssl;

      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 1,
        lineStyle: 3,
        lastValueVisible: true,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        title: `${zone.type} (${zone.touchCount}x)`,
      });

      const lineData = ensureUniqueAscending([
        { time: zone.startTime, value: zone.price },
        { time: lastTime, value: zone.price },
      ]);

      if (lineData.length >= 2) {
        line.setData(lineData);
        lines.push(line);
      }
    }

    refs.current.liquidityLines = lines;
  }, [chart, analysis, isDark, lastTime]);

  const renderOTEZones = useCallback(() => {
    if (!chart || !analysis?.oteZones.length || !seriesRef.current) return;

    const colors = getICTColors(isDark);
    const primitives: BandPrimitive[] = [];
    const recentOTEs = analysis.oteZones.slice(-2);

    for (const ote of recentOTEs) {
      const primitive = new BandPrimitive({
        startTime: ote.startTime,
        endTime: ote.endTime,
        levels: [
          { price: ote.goldenPocketHigh, color: colors.ote.line, lineWidth: 1, label: "0.618" },
          { price: ote.goldenPocketLow, color: colors.ote.line, lineWidth: 1, label: "0.786" },
          {
            price: ote.fibLevels["0.5"],
            color: colors.ote.muted,
            lineWidth: 1,
            dashed: true,
            label: "EQ",
          },
          { price: ote.fibLevels["0.382"], color: colors.ote.muted, lineWidth: 1, dashed: true },
        ],
        fillBetween: [
          { top: ote.goldenPocketHigh, bottom: ote.goldenPocketLow, color: colors.ote.fill },
        ],
      });

      seriesRef.current.attachPrimitive(primitive);
      primitives.push(primitive);
    }

    refs.current.otePrimitives = primitives;
  }, [chart, analysis, isDark]);

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
