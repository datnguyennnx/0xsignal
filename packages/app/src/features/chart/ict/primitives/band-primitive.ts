import type {
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  IChartApi,
  ISeriesApi,
  Time,
} from "lightweight-charts";

interface BitmapScope {
  context: CanvasRenderingContext2D;
  horizontalPixelRatio: number;
  verticalPixelRatio: number;
}

interface RenderTarget {
  useBitmapCoordinateSpace: (callback: (scope: BitmapScope) => void) => void;
}

export interface BandLevel {
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

class BandPaneRenderer implements IPrimitivePaneRenderer {
  private _data: RenderData | null = null;

  update(data: RenderData | null): void {
    this._data = data;
  }

  draw(target: RenderTarget): void {
    if (!this._data) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const { x1, x2, levels, fills } = this._data!;
      const { horizontalPixelRatio, verticalPixelRatio } = scope;

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

        if (level.dashed) {
          ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
        }

        ctx.beginPath();
        ctx.moveTo(left, scaledY);
        ctx.lineTo(right, scaledY);
        ctx.stroke();
        ctx.setLineDash([]);

        if (level.label) {
          const fontSize = Math.round(9 * horizontalPixelRatio);
          ctx.font = `${fontSize}px sans-serif`;
          ctx.fillStyle = level.color;
          ctx.textBaseline = "bottom";
          ctx.fillText(level.label, right + 4 * horizontalPixelRatio, scaledY);
        }
      }
    });
  }
}

class BandPaneView implements IPrimitivePaneView {
  private _renderer = new BandPaneRenderer();
  private _data: RenderData | null = null;

  update(data: RenderData | null): void {
    this._data = data;
    this._renderer.update(data);
  }

  zOrder(): PrimitivePaneViewZOrder {
    return "bottom";
  }

  renderer(): IPrimitivePaneRenderer {
    return this._renderer;
  }
}

export class BandPrimitive implements ISeriesPrimitive<Time> {
  private _paneView = new BandPaneView();
  private _options: BandOptions;
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;

  constructor(options: BandOptions) {
    this._options = options;
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series as ISeriesApi<"Candlestick">;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
  }

  updateOptions(options: Partial<BandOptions>): void {
    this._options = { ...this._options, ...options };
  }

  updateAllViews(): void {
    if (!this._chart || !this._series) {
      this._paneView.update(null);
      return;
    }

    const timeScale = this._chart.timeScale();
    const x1 = timeScale.timeToCoordinate(this._options.startTime as Time);
    const x2 = timeScale.timeToCoordinate(this._options.endTime as Time);

    if (x1 === null || x2 === null) {
      this._paneView.update(null);
      return;
    }

    const levels: { y: number; level: BandLevel }[] = [];
    for (const level of this._options.levels) {
      const y = this._series.priceToCoordinate(level.price);
      if (y !== null) {
        levels.push({ y: y as number, level });
      }
    }

    const fills: { y1: number; y2: number; color: string }[] = [];
    if (this._options.fillBetween) {
      for (const fill of this._options.fillBetween) {
        const y1 = this._series.priceToCoordinate(fill.top);
        const y2 = this._series.priceToCoordinate(fill.bottom);
        if (y1 !== null && y2 !== null) {
          fills.push({ y1: y1 as number, y2: y2 as number, color: fill.color });
        }
      }
    }

    this._paneView.update({
      x1: x1 as number,
      x2: x2 as number,
      levels,
      fills,
    });
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
