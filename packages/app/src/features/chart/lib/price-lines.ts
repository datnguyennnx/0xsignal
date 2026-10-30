import { useEffect } from "react";
import {
  LineStyle,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineWidth,
  type SeriesType,
} from "lightweight-charts";

import { toRgba } from "./color";

/** Chart-feature vocabulary: callers never see a lightweight-charts type. */
export interface ChartPriceLine {
  price: number;
  tone: "gain" | "loss" | "muted" | "accent";
  /** Crowd levels recede to a hairline; the subject's own levels carry the weight. */
  emphasis: "crowd" | "subject";
  title?: string;
  dashed?: boolean;
  axisLabelVisible?: boolean;
}

const TONE_TOKENS: Record<ChartPriceLine["tone"], string> = {
  gain: "--gain",
  loss: "--loss",
  muted: "--muted-foreground",
  accent: "--accent-ink",
};

const EMPHASIS_STYLE: Record<ChartPriceLine["emphasis"], { lineWidth: LineWidth; alpha: number }> =
  {
    crowd: { lineWidth: 1, alpha: 0.5 },
    subject: { lineWidth: 2, alpha: 1 },
  };

const readToneColor = (tone: ChartPriceLine["tone"]): string =>
  getComputedStyle(document.documentElement).getPropertyValue(TONE_TOKENS[tone]).trim();

const isDrawable = (line: ChartPriceLine): boolean => Number.isFinite(line.price) && line.price > 0;

/**
 * Draws on the candlestick series, so the series handle is the identity that
 * matters: the engine swaps it whenever it rebuilds the chart.
 */
export function usePriceLines<TSeries extends SeriesType>(
  chart: IChartApi | null,
  series: ISeriesApi<TSeries> | null,
  priceLines: readonly ChartPriceLine[] | undefined,
): void {
  useEffect(() => {
    const drawn: IPriceLine[] = [];

    if (chart !== null && series !== null && priceLines !== undefined) {
      for (const line of priceLines) {
        if (!isDrawable(line)) continue;
        const style = EMPHASIS_STYLE[line.emphasis];
        drawn.push(
          series.createPriceLine({
            price: line.price,
            color: toRgba(readToneColor(line.tone), style.alpha),
            title: line.title ?? "",
            lineWidth: style.lineWidth,
            lineStyle: line.dashed === true ? LineStyle.Dashed : LineStyle.Solid,
            axisLabelVisible: line.axisLabelVisible === true,
            lineVisible: true,
          }),
        );
      }
    }

    return () => {
      // A destroyed chart keeps no panes, and its removal took the lines with it.
      if (chart === null || series === null || chart.panes().length === 0) return;
      for (const handle of drawn) series.removePriceLine(handle);
    };
  }, [chart, series, priceLines]);
}
