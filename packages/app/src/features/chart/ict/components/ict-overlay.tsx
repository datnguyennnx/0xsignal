/**
 * @overview ICT (Inner Circle Trader) Chart Overlay Hook
 *
 * It renders complex ICT market primitives (FVGs, Order Blocks, Liquidity, OTE)
 * using custom LW-Charts primitives (Zone, Band) and standard Line series.
 *
 * @mechanism
 * - utilizes ZonePrimitive for FVG and OB shaded areas.
 * - utilizes BandPrimitive for layered OTE fib levels and Golden Pocket shading.
 * - utilizes LineSeries for Market Structure pivots (HH, LL) and trend breaks (BOS, ChoCH).
 * - implements an efficient 150ms-throttled worker orchestration via the parent component.
 */
import { useEffect, useRef, useCallback } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import { LineSeries } from "lightweight-charts";
import type { ICTAnalysis } from "@0xsignal/shared";
import type { ICTVisibility } from "../types";
import { ZonePrimitive } from "../primitives";
import { BandPrimitive } from "../primitives";
import { getICTColors } from "../utils";
import { ensureUniqueAscending } from "../../utils/ensure-unique-ascending";

interface ICTOverlayProps {
  chart: IChartApi | null;
  series?: ISeriesApi<"Candlestick"> | null;
  analysis: ICTAnalysis | null;
  visibility: ICTVisibility;
  lastTime: number;
}

interface ICTRefs {
  swingLines: ISeriesApi<"Line">[];
  fvgPrimitives: ZonePrimitive[];
  obPrimitives: ZonePrimitive[];
  liquidityLines: ISeriesApi<"Line">[];
  otePrimitives: BandPrimitive[];
}

export function useICTOverlay({ chart, series, analysis, visibility, lastTime }: ICTOverlayProps) {
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

  const appliedKeysRef = useRef({
    marketStructure: "",
    fvg: "",
    orderBlocks: "",
    liquidity: "",
    ote: "",
  });

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

    appliedKeysRef.current = {
      marketStructure: "",
      fvg: "",
      orderBlocks: "",
      liquidity: "",
      ote: "",
    };
  }, [chart]);

  const renderMarketStructure = useCallback(() => {
    if (!chart || !analysis?.marketStructure) return;
    const { swings, events } = analysis.marketStructure;

    const key = `ms-${swings.length}-${events.length}-${lastTime}`;
    if (appliedKeysRef.current.marketStructure === key) return;

    // Remove old lines before adding new ones
    refs.current.swingLines.forEach((l) => {
      try {
        chart.removeSeries(l);
      } catch {}
    });

    const colors = getICTColors();
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
    appliedKeysRef.current.marketStructure = key;
  }, [chart, analysis, lastTime]);

  // Similar key-based skip for other renders
  const renderFVGs = useCallback(() => {
    if (!chart || !analysis?.fvgs.length || !seriesRef.current) return;
    const key = `fvg-${analysis.fvgs.length}-${lastTime}`;
    if (appliedKeysRef.current.fvg === key) return;

    const s = seriesRef.current;
    refs.current.fvgPrimitives.forEach((p) => {
      try {
        s.detachPrimitive(p);
      } catch {}
    });

    const colors = getICTColors();
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
      s.attachPrimitive(primitive);
      primitives.push(primitive);
    }
    refs.current.fvgPrimitives = primitives;
    appliedKeysRef.current.fvg = key;
  }, [chart, analysis, lastTime]);

  const renderOrderBlocks = useCallback(() => {
    if (!chart || !analysis?.orderBlocks.length || !seriesRef.current) return;
    const key = `ob-${analysis.orderBlocks.length}-${lastTime}`;
    if (appliedKeysRef.current.orderBlocks === key) return;

    const s = seriesRef.current;
    refs.current.obPrimitives.forEach((p) => {
      try {
        s.detachPrimitive(p);
      } catch {}
    });

    const colors = getICTColors();
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
      s.attachPrimitive(primitive);
      primitives.push(primitive);
    }
    refs.current.obPrimitives = primitives;
    appliedKeysRef.current.orderBlocks = key;
  }, [chart, analysis, lastTime]);

  const renderLiquidityZones = useCallback(() => {
    if (!chart || !analysis?.liquidityZones.length) return;
    const key = `liq-${analysis.liquidityZones.length}-${lastTime}`;
    if (appliedKeysRef.current.liquidity === key) return;

    refs.current.liquidityLines.forEach((l) => {
      try {
        chart.removeSeries(l);
      } catch {}
    });

    const colors = getICTColors();
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
    appliedKeysRef.current.liquidity = key;
  }, [chart, analysis, lastTime]);

  const renderOTEZones = useCallback(() => {
    if (!chart || !analysis?.oteZones.length || !seriesRef.current) return;
    const key = `ote-${analysis.oteZones.length}`;
    if (appliedKeysRef.current.ote === key) return;

    const s = seriesRef.current;
    refs.current.otePrimitives.forEach((p) => {
      try {
        s.detachPrimitive(p);
      } catch {}
    });

    const colors = getICTColors();
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
      s.attachPrimitive(primitive);
      primitives.push(primitive);
    }
    refs.current.otePrimitives = primitives;
    appliedKeysRef.current.ote = key;
  }, [chart, analysis]);

  useEffect(() => {
    if (!chart || !analysis) {
      cleanup();
      return;
    }

    if (visibility.marketStructure) renderMarketStructure();
    else {
      refs.current.swingLines.forEach((l) => {
        try {
          chart.removeSeries(l);
        } catch {}
      });
      refs.current.swingLines = [];
      appliedKeysRef.current.marketStructure = "";
    }

    if (visibility.fvg) renderFVGs();
    else {
      const s = seriesRef.current;
      if (s)
        refs.current.fvgPrimitives.forEach((p) => {
          try {
            s.detachPrimitive(p);
          } catch {}
        });
      refs.current.fvgPrimitives = [];
      appliedKeysRef.current.fvg = "";
    }

    if (visibility.orderBlocks) renderOrderBlocks();
    else {
      const s = seriesRef.current;
      if (s)
        refs.current.obPrimitives.forEach((p) => {
          try {
            s.detachPrimitive(p);
          } catch {}
        });
      refs.current.obPrimitives = [];
      appliedKeysRef.current.orderBlocks = "";
    }

    if (visibility.liquidity) renderLiquidityZones();
    else {
      refs.current.liquidityLines.forEach((l) => {
        try {
          chart.removeSeries(l);
        } catch {}
      });
      refs.current.liquidityLines = [];
      appliedKeysRef.current.liquidity = "";
    }

    if (visibility.ote) renderOTEZones();
    else {
      const s = seriesRef.current;
      if (s)
        refs.current.otePrimitives.forEach((p) => {
          try {
            s.detachPrimitive(p);
          } catch {}
        });
      refs.current.otePrimitives = [];
      appliedKeysRef.current.ote = "";
    }

    return cleanup;
  }, [
    chart,
    analysis,
    visibility,
    renderMarketStructure,
    renderFVGs,
    renderOrderBlocks,
    renderLiquidityZones,
    renderOTEZones,
    cleanup,
  ]);

  return { cleanup };
}
