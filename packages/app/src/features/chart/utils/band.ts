import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  IChartApi,
  ISeriesApi,
  SeriesType,
} from "lightweight-charts";
import { remToPx } from "@/core/utils/rem";
import { isUtcTimestamp } from "../lib/time";

interface BandLevel {
  price: number;
  color: string;
  lineWidth: number;
  dashed?: boolean;
  label?: string;
}

export interface BandOptions {
  startTime: number;
  endTime: number;
  levels: BandLevel[];
  fillBetween?: { top: number; bottom: number; color: string }[];
}

interface RenderData {
  x1: number;
  x2: number;
  levels: { y: number; level: BandLevel }[];
  fills: { y1: number; y2: number; color: string }[];
}

interface BandPaneRenderer extends IPrimitivePaneRenderer {
  update: (data: RenderData | null) => void;
}

interface BandPaneView extends IPrimitivePaneView {
  update: (data: RenderData | null) => void;
}

const createBandPaneRenderer = (): BandPaneRenderer => {
  let data: RenderData | null = null;

  return {
    update: (next) => {
      data = next;
    },
    draw: (target) => {
      const renderData = data;
      if (renderData === null) return;

      target.useBitmapCoordinateSpace((scope) => {
        const { x1, x2, levels, fills } = renderData;
        const { horizontalPixelRatio, verticalPixelRatio, context: ctx } = scope;

        const scaledX1 = Math.round(x1 * horizontalPixelRatio);
        const scaledX2 = Math.round(x2 * horizontalPixelRatio);
        const left = Math.min(scaledX1, scaledX2);
        const right = Math.max(scaledX1, scaledX2);

        for (const fill of fills) {
          const top = Math.round(Math.min(fill.y1, fill.y2) * verticalPixelRatio);
          const bottom = Math.round(Math.max(fill.y1, fill.y2) * verticalPixelRatio);
          ctx.fillStyle = fill.color;
          ctx.fillRect(left, top, right - left, bottom - top);
        }

        for (const { y, level } of levels) {
          const scaledY = Math.round(y * verticalPixelRatio);
          ctx.strokeStyle = level.color;
          ctx.lineWidth = level.lineWidth * horizontalPixelRatio;

          if (level.dashed === true) {
            ctx.setLineDash([
              remToPx(0.25) * horizontalPixelRatio,
              remToPx(0.25) * horizontalPixelRatio,
            ]);
          }

          ctx.beginPath();
          ctx.moveTo(left, scaledY);
          ctx.lineTo(right, scaledY);
          ctx.stroke();
          ctx.setLineDash([]);

          if (level.label !== undefined && level.label !== "") {
            const fontSize = Math.round(remToPx(0.5625) * horizontalPixelRatio);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = level.color;
            ctx.textBaseline = "bottom";
            ctx.fillText(level.label, right + remToPx(0.25) * horizontalPixelRatio, scaledY);
          }
        }
      });
    },
  };
};

const createBandPaneView = (): BandPaneView => {
  const renderer = createBandPaneRenderer();

  return {
    update: (data) => {
      renderer.update(data);
    },
    zOrder: (): PrimitivePaneViewZOrder => "bottom",
    renderer: () => renderer,
  };
};

export class BandPrimitive implements ISeriesPrimitive {
  private paneView = createBandPaneView();
  private options: BandOptions;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;

  constructor(options: BandOptions) {
    this.options = options;
  }

  attached(param: SeriesAttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
  }

  updateOptions(options: Partial<BandOptions>): void {
    this.options = { ...this.options, ...options };
  }

  updateAllViews(): void {
    const { chart, series } = this;
    if (chart === null || series === null) {
      this.paneView.update(null);
      return;
    }

    const timeScale = chart.timeScale();
    const { startTime, endTime } = this.options;
    if (!isUtcTimestamp(startTime) || !isUtcTimestamp(endTime)) {
      this.paneView.update(null);
      return;
    }
    const x1 = timeScale.timeToCoordinate(startTime);
    const x2 = timeScale.timeToCoordinate(endTime);

    if (x1 === null || x2 === null) {
      this.paneView.update(null);
      return;
    }

    const levels: { y: number; level: BandLevel }[] = [];
    for (const level of this.options.levels) {
      const y = series.priceToCoordinate(level.price);
      if (y !== null) {
        levels.push({ y, level });
      }
    }

    const fills: { y1: number; y2: number; color: string }[] = [];
    if (this.options.fillBetween !== undefined) {
      for (const fill of this.options.fillBetween) {
        const y1 = series.priceToCoordinate(fill.top);
        const y2 = series.priceToCoordinate(fill.bottom);
        if (y1 !== null && y2 !== null) {
          fills.push({ y1, y2, color: fill.color });
        }
      }
    }

    this.paneView.update({
      x1,
      x2,
      levels,
      fills,
    });
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }
}
