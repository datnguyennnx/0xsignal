// Chart feature types
import type { IChartApi, ISeriesApi, Time } from "lightweight-charts";

export interface ChartDataPoint {
  readonly time: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}

export interface ChartPane {
  readonly index: number;
  readonly height: number;
  readonly series: ReadonlyArray<ISeriesApi<any>>;
}

export interface IndicatorSeries {
  readonly id: string;
  readonly paneIndex: number;
  readonly series: ISeriesApi<any>;
}

export interface ChartState {
  readonly chart: IChartApi | null;
  readonly panes: ReadonlyMap<number, ChartPane>;
  readonly indicators: ReadonlyMap<string, IndicatorSeries>;
}
