/**
 * @overview Chart Indicator Shared Types
 */
import type { BandIndicatorDataPoint, IndicatorDataPoint } from "@0xsignal/shared";

export type IndicatorUpdateMode = "setData" | "append" | "replaceLast";

export interface IndicatorDataMeta {
  cacheKey: string;
  paramsKey: string;
  mode: IndicatorUpdateMode;
  dataLength: number;
  lastTime: number;
}

export type LineRenderEntry = {
  type: "line";
  data: IndicatorDataPoint[];
  lastPoint: IndicatorDataPoint | null;
  meta: IndicatorDataMeta;
};

export type HistogramRenderEntry = {
  type: "histogram";
  data: IndicatorDataPoint[];
  lastPoint: IndicatorDataPoint | null;
  meta: IndicatorDataMeta;
};

export type BandRenderEntry = {
  type: "band";
  data: BandIndicatorDataPoint[];
  lastPoint: BandIndicatorDataPoint | null;
  meta: IndicatorDataMeta;
};

export type IndicatorRenderEntry = LineRenderEntry | HistogramRenderEntry | BandRenderEntry;
