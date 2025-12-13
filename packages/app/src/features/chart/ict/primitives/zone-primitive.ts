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

export interface ZoneOptions {
  startTime: number;
  endTime: number;
  highPrice: number;
  lowPrice: number;
  fillColor: string;
  borderColor: string;
  borderWidth?: number;
  label?: string;
  showMidline?: boolean;
  midlineColor?: string;
}

interface RenderData {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  yMid: number;
  options: ZoneOptions;
}

class ZonePaneRenderer implements IPrimitivePaneRenderer {
  private _data: RenderData | null = null;

  update(data: RenderData | null): void {
    this._data = data;
  }

  draw(target: RenderTarget): void {
    if (!this._data) return;

    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context;
      const { x1, x2, y1, y2, yMid, options } = this._data!;
      const { horizontalPixelRatio, verticalPixelRatio } = scope;

      const scaledX1 = Math.round(x1 * horizontalPixelRatio);
      const scaledX2 = Math.round(x2 * horizontalPixelRatio);
      const scaledY1 = Math.round(y1 * verticalPixelRatio);
      const scaledY2 = Math.round(y2 * verticalPixelRatio);
      const scaledYMid = Math.round(yMid * verticalPixelRatio);

      const left = Math.min(scaledX1, scaledX2);
      const right = Math.max(scaledX1, scaledX2);
      const top = Math.min(scaledY1, scaledY2);
      const bottom = Math.max(scaledY1, scaledY2);
      const width = right - left;
      const height = bottom - top;

      if (width <= 0 || height <= 0) return;

      ctx.fillStyle = options.fillColor;
      ctx.fillRect(left, top, width, height);

      if (options.borderWidth && options.borderWidth > 0) {
        ctx.strokeStyle = options.borderColor;
        ctx.lineWidth = options.borderWidth * horizontalPixelRatio;
        ctx.strokeRect(left, top, width, height);
      }

      if (options.showMidline && options.midlineColor) {
        ctx.strokeStyle = options.midlineColor;
        ctx.lineWidth = 1 * horizontalPixelRatio;
        ctx.setLineDash([4 * horizontalPixelRatio, 4 * horizontalPixelRatio]);
        ctx.beginPath();
        ctx.moveTo(left, scaledYMid);
        ctx.lineTo(right, scaledYMid);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (options.label) {
        const fontSize = Math.round(10 * horizontalPixelRatio);
        ctx.font = `${fontSize}px sans-serif`;
        ctx.fillStyle = options.borderColor;
        ctx.textBaseline = "top";
        ctx.fillText(options.label, left + 4 * horizontalPixelRatio, top + 2 * verticalPixelRatio);
      }
    });
  }
}

class ZonePaneView implements IPrimitivePaneView {
  private _renderer = new ZonePaneRenderer();
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

export class ZonePrimitive implements ISeriesPrimitive<Time> {
  private _paneView = new ZonePaneView();
  private _options: ZoneOptions;
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;

  constructor(options: ZoneOptions) {
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

  updateOptions(options: Partial<ZoneOptions>): void {
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

    const y1 = this._series.priceToCoordinate(this._options.highPrice);
    const y2 = this._series.priceToCoordinate(this._options.lowPrice);
    const yMid = this._series.priceToCoordinate(
      (this._options.highPrice + this._options.lowPrice) / 2
    );

    if (y1 === null || y2 === null || yMid === null) {
      this._paneView.update(null);
      return;
    }

    this._paneView.update({
      x1: x1 as number,
      x2: x2 as number,
      y1: y1 as number,
      y2: y2 as number,
      yMid: yMid as number,
      options: this._options,
    });
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this._paneView];
  }
}
