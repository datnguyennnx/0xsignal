import type { BandIndicatorDataPoint, IndicatorDataPoint } from "@0xsignal/shared";

export interface IndicatorDataMeta {
  cacheKey: string;
}

type LineRenderEntry = {
  type: "line";
  data: IndicatorDataPoint[];
  meta: IndicatorDataMeta;
};

type HistogramRenderEntry = {
  type: "histogram";
  data: IndicatorDataPoint[];
  meta: IndicatorDataMeta;
};

type BandRenderEntry = {
  type: "band";
  data: BandIndicatorDataPoint[];
  meta: IndicatorDataMeta;
};

export type IndicatorRenderEntry = LineRenderEntry | HistogramRenderEntry | BandRenderEntry;
