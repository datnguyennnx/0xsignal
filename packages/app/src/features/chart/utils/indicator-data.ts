import type { BandIndicatorDataPoint, IndicatorDataPoint } from "@0xsignal/shared";

type IndicatorUpdateMode = "setData" | "append" | "replaceLast";

export interface IndicatorDataMeta {
  cacheKey: string;
  paramsKey: string;
  mode: IndicatorUpdateMode;
  dataLength: number;
  lastTime: number;
}

type LineRenderEntry = {
  type: "line";
  data: IndicatorDataPoint[];
  lastPoint: IndicatorDataPoint | null;
  meta: IndicatorDataMeta;
};

type HistogramRenderEntry = {
  type: "histogram";
  data: IndicatorDataPoint[];
  lastPoint: IndicatorDataPoint | null;
  meta: IndicatorDataMeta;
};

type BandRenderEntry = {
  type: "band";
  data: BandIndicatorDataPoint[];
  lastPoint: BandIndicatorDataPoint | null;
  meta: IndicatorDataMeta;
};

export type IndicatorRenderEntry = LineRenderEntry | HistogramRenderEntry | BandRenderEntry;
