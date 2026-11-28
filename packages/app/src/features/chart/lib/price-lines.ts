import { useEffect, useState } from "react";
import {
  LineStyle,
  type IChartApi,
  type CreatePriceLineOptions,
  type IPriceLine,
  type ISeriesApi,
  type LineWidth,
  type SeriesType,
} from "lightweight-charts";

import { toRgba } from "./color";
import { useChartTheme, type ChartToken } from "./theme-store";

/** Chart-feature vocabulary: callers never see a lightweight-charts type. */
export interface ChartPriceLine {
  price: number;
  tone: "gain" | "loss" | "muted" | "accent" | "warn";
  /** Crowd levels recede to a hairline; the subject's own levels carry the weight. */
  emphasis: "crowd" | "subject";
  title?: string;
  dashed?: boolean;
  axisLabelVisible?: boolean;
}

export type AlertSeverity = "info" | "warn" | "critical";

/** An armed alert level lives above the generic line vocabulary: severity picks the colour. */
export interface AlertPriceLevel {
  price: number;
  severity: AlertSeverity;
  label: string;
}

const TONE_TOKENS: Record<ChartPriceLine["tone"], ChartToken> = {
  gain: "--gain",
  loss: "--loss",
  muted: "--muted-foreground",
  accent: "--accent-ink",
  warn: "--warn",
};

const SEVERITY_TONE: Record<AlertSeverity, ChartPriceLine["tone"]> = {
  info: "accent",
  warn: "warn",
  critical: "loss",
};

const MAX_ALERT_LINES = 5;

const EMPHASIS_STYLE: Record<ChartPriceLine["emphasis"], { lineWidth: LineWidth; alpha: number }> =
  {
    crowd: { lineWidth: 1, alpha: 0.5 },
    subject: { lineWidth: 2, alpha: 1 },
  };

const isDrawable = (line: ChartPriceLine): boolean => Number.isFinite(line.price) && line.price > 0;

/** Insert before the first entry the predicate says must follow, else append. */
function insertOrdered(
  levels: AlertPriceLevel[],
  level: AlertPriceLevel,
  mustFollow: (candidate: AlertPriceLevel) => boolean,
): void {
  const index = levels.findIndex((candidate) => mustFollow(candidate));
  if (index === -1) levels.push(level);
  else levels.splice(index, 0, level);
}

/**
 * The axis belongs to the last price: only the five levels closest to it are worth
 * drawing. Keeping the emitted order price-ascending means a moving last price
 * updates the same handles in place; only crossing the five-level boundary rebuilds.
 */
export function alertLevelsToPriceLines(
  levels: readonly AlertPriceLevel[] | undefined,
  lastPrice: number | null | undefined,
): ChartPriceLine[] {
  if (levels === undefined || lastPrice === null || lastPrice === undefined) return [];
  if (!Number.isFinite(lastPrice)) return [];

  const nearest: AlertPriceLevel[] = [];
  for (const level of levels) {
    if (!Number.isFinite(level.price) || level.price <= 0) continue;
    const distance = Math.abs(level.price - lastPrice);
    insertOrdered(nearest, level, (candidate) => Math.abs(candidate.price - lastPrice) > distance);
    if (nearest.length > MAX_ALERT_LINES) nearest.pop();
  }

  const byPrice: AlertPriceLevel[] = [];
  for (const level of nearest) {
    insertOrdered(byPrice, level, (candidate) => candidate.price > level.price);
  }

  return byPrice.map((level) => ({
    price: level.price,
    tone: SEVERITY_TONE[level.severity],
    emphasis: "subject",
    title: "",
    dashed: true,
    axisLabelVisible: false,
  }));
}

/** Everything except the price: a change here is what a price tick never touches. */
const styleKey = (line: ChartPriceLine): string =>
  [
    line.tone,
    line.emphasis,
    line.dashed === true ? "dashed" : "solid",
    line.axisLabelVisible === true ? "label" : "bare",
    line.title ?? "",
  ].join("|");

const toPriceLineOptions = (
  line: ChartPriceLine,
  colors: Record<string, string>,
): CreatePriceLineOptions => {
  const style = EMPHASIS_STYLE[line.emphasis];
  return {
    price: line.price,
    color: toRgba(colors[TONE_TOKENS[line.tone]], style.alpha),
    title: line.title ?? "",
    lineWidth: style.lineWidth,
    lineStyle: line.dashed === true ? LineStyle.Dashed : LineStyle.Solid,
    axisLabelVisible: line.axisLabelVisible === true,
    lineVisible: true,
  };
};

/** The chart's price-line handles plus the style signatures they were created from. */
export interface PriceLineState {
  handles: IPriceLine[];
  styleKeys: string[];
}

const createPriceLineState = (): PriceLineState => ({ handles: [], styleKeys: [] });

type PriceLineSeries = Pick<ISeriesApi<SeriesType>, "createPriceLine" | "removePriceLine">;

/**
 * Reconcile the drawn lines with the requested set. The same set (identified by
 * everything but price) is moved in place via `applyOptions`; create/remove only
 * runs when a line appears, disappears, or changes its style contract.
 */
export function syncPriceLines(
  series: PriceLineSeries,
  state: PriceLineState,
  priceLines: readonly ChartPriceLine[] | undefined,
  colors: Record<string, string>,
): void {
  const drawable = priceLines?.filter((line) => isDrawable(line)) ?? [];
  const nextKeys = drawable.map((line) => styleKey(line));
  const sameSet =
    nextKeys.length === state.styleKeys.length &&
    nextKeys.every((key, index) => key === state.styleKeys[index]);

  if (!sameSet) {
    for (const handle of state.handles) series.removePriceLine(handle);
    state.handles = drawable.map((line) =>
      series.createPriceLine(toPriceLineOptions(line, colors)),
    );
    state.styleKeys = nextKeys;
    return;
  }

  for (const [index, line] of drawable.entries()) {
    state.handles[index]?.applyOptions(toPriceLineOptions(line, colors));
  }
}

export function removePriceLines(series: PriceLineSeries, state: PriceLineState): void {
  for (const handle of state.handles) series.removePriceLine(handle);
  state.handles = [];
  state.styleKeys = [];
}

/**
 * Draws on the candlestick series, so the series handle is the identity that
 * matters: the engine swaps it whenever it rebuilds the chart.
 */
export function usePriceLines<TSeries extends SeriesType>(
  chart: IChartApi | null,
  series: ISeriesApi<TSeries> | null,
  priceLines: readonly ChartPriceLine[] | undefined,
): void {
  const theme = useChartTheme();
  // Lazy initializer: the factory runs once per mount and the state identity is
  // stable across renders, so the reconciler mutates one object instead of
  // allocating a fresh one every pass. No ref is read during render.
  const [state] = useState(createPriceLineState);

  useEffect(() => {
    if (chart === null || series === null) return;
    syncPriceLines(series, state, priceLines, theme.colors);
  }, [chart, series, priceLines, theme, state]);

  useEffect(() => {
    return () => {
      // A destroyed chart keeps no panes, and its removal took the lines with it.
      if (chart === null || series === null || chart.panes().length === 0) {
        state.handles = [];
        state.styleKeys = [];
        return;
      }
      removePriceLines(series, state);
    };
  }, [chart, series, state]);
}
