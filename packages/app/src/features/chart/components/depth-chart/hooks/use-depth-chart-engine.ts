import { useCallback, useEffect, useMemo, useRef } from "react";
import { DEPTH_COLORS, type DepthLevel, type DepthRenderableBounds } from "../constants";
import { resolveDepthStepEpsilon } from "../lib/depth-step-transform";
import { getDepthMaxTotal, mapDepthSideToCanvasPoints } from "../lib/depth-canvas-mapping";

export interface DepthChartEngineOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isDark: boolean;
  tickSize: number;
  visibleRangeResetKey: string;
}

export interface DepthChartEngineResult {
  updateDepthData: (
    bids: DepthLevel[],
    asks: DepthLevel[],
    bounds: DepthRenderableBounds | null,
    maxTotal?: number
  ) => void;
}

interface DepthPayload {
  bids: DepthLevel[];
  asks: DepthLevel[];
  bounds: DepthRenderableBounds | null;
  maxTotal?: number;
  hash: string;
}

const UPDATE_THROTTLE_MS = 120;
const TOP_PADDING = 12;
const BOTTOM_PADDING = 24;
const GRID_LINES = 6;
const X_TICKS = 6;
const Y_TICKS = 5;

function hashLevels(levels: DepthLevel[]): string {
  return levels.map((level) => `${level.price}:${level.total}`).join("|");
}

function getPriceDecimals(tickSize: number): number {
  if (!Number.isFinite(tickSize) || tickSize <= 0) {
    return 2;
  }
  return Math.max(0, Math.ceil(-Math.log10(tickSize)));
}

function formatNumber(value: number, maxDecimals: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  points: Array<{ x: number; y: number }>,
  closePath = false
): void {
  if (!points.length) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index++) {
    const point = points[index];
    ctx.lineTo(point.x, point.y);
  }

  if (closePath) {
    ctx.closePath();
  }
}

function drawHorizontalGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  gridColor: string
): void {
  const drawHeight = Math.max(height - TOP_PADDING - BOTTOM_PADDING, 1);
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let index = 0; index <= GRID_LINES; index++) {
    const y = TOP_PADDING + (drawHeight / GRID_LINES) * index;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawAxes(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  bounds: DepthRenderableBounds,
  maxTotal: number,
  tickSize: number,
  isDark: boolean
): void {
  const drawHeight = Math.max(height - TOP_PADDING - BOTTOM_PADDING, 1);
  const priceDecimals = getPriceDecimals(tickSize);
  const labelColor = isDark ? "rgba(240,240,240,0.72)" : "rgba(30,30,30,0.72)";
  const axisColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";

  ctx.strokeStyle = axisColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - BOTTOM_PADDING + 0.5);
  ctx.lineTo(width, height - BOTTOM_PADDING + 0.5);
  ctx.stroke();

  const span = Math.max(bounds.maxPrice - bounds.minPrice, 0.00000001);
  const centerX = ((bounds.centerPrice - bounds.minPrice) / span) * width;
  if (Number.isFinite(centerX) && centerX >= 0 && centerX <= width) {
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(centerX, TOP_PADDING);
    ctx.lineTo(centerX, height - BOTTOM_PADDING);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = labelColor;
  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "center";
  for (let index = 0; index < X_TICKS; index++) {
    const ratio = index / (X_TICKS - 1);
    const x = ratio * width;
    const price = bounds.minPrice + (bounds.maxPrice - bounds.minPrice) * ratio;
    ctx.fillText(formatNumber(price, priceDecimals), x, height - BOTTOM_PADDING + 6);
  }

  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  for (let index = 0; index <= Y_TICKS; index++) {
    const ratio = index / Y_TICKS;
    const y = TOP_PADDING + drawHeight * (1 - ratio);
    const value = maxTotal * ratio;
    ctx.fillText(formatNumber(value, 2), 6, y);
  }
}

export function useDepthChartEngine({
  containerRef,
  canvasRef,
  isDark,
  tickSize,
  visibleRangeResetKey,
}: DepthChartEngineOptions): DepthChartEngineResult {
  const applyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<DepthPayload | null>(null);
  const lastAppliedPayloadRef = useRef<DepthPayload | null>(null);
  const lastRenderedHashRef = useRef("");
  const lastApplyRef = useRef(0);

  const canvasWidthRef = useRef(0);
  const canvasHeightRef = useRef(0);
  const tickSizeRef = useRef(tickSize);

  const colors = useMemo(
    () => ({
      grid: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.08)",
      bidFill: "rgba(38,166,154,0.18)",
      askFill: "rgba(239,83,80,0.18)",
    }),
    [isDark]
  );

  useEffect(() => {
    tickSizeRef.current = tickSize;
  }, [tickSize]);

  const drawPayload = useCallback(
    (payload: DepthPayload | null) => {
      const canvas = canvasRef.current;
      if (!canvas || !payload) {
        return;
      }

      const width = canvasWidthRef.current;
      const height = canvasHeightRef.current;
      if (width <= 0 || height <= 0) {
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.clearRect(0, 0, width, height);
      if (!payload.bounds || !payload.bids.length || !payload.asks.length) {
        return;
      }

      drawHorizontalGrid(ctx, width, height, colors.grid);

      const epsilon = resolveDepthStepEpsilon(
        payload.bids,
        payload.asks,
        null,
        tickSizeRef.current
      );
      const maxTotal = payload.maxTotal ?? getDepthMaxTotal(payload.bids, payload.asks);
      const bidPath = mapDepthSideToCanvasPoints({
        levels: payload.bids,
        side: "bids",
        bounds: payload.bounds,
        width,
        height,
        epsilon,
        maxTotal,
        topPadding: TOP_PADDING,
        bottomPadding: BOTTOM_PADDING,
      });
      const askPath = mapDepthSideToCanvasPoints({
        levels: payload.asks,
        side: "asks",
        bounds: payload.bounds,
        width,
        height,
        epsilon,
        maxTotal,
        topPadding: TOP_PADDING,
        bottomPadding: BOTTOM_PADDING,
      });

      if (bidPath.area.length) {
        drawPath(ctx, bidPath.area, true);
        ctx.fillStyle = colors.bidFill;
        ctx.fill();
      }
      if (askPath.area.length) {
        drawPath(ctx, askPath.area, true);
        ctx.fillStyle = colors.askFill;
        ctx.fill();
      }
      if (bidPath.line.length) {
        drawPath(ctx, bidPath.line);
        ctx.strokeStyle = DEPTH_COLORS.bid.line;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      if (askPath.line.length) {
        drawPath(ctx, askPath.line);
        ctx.strokeStyle = DEPTH_COLORS.ask.line;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      drawAxes(ctx, width, height, payload.bounds, maxTotal, tickSizeRef.current, isDark);
    },
    [canvasRef, colors.askFill, colors.bidFill, colors.grid, isDark]
  );

  const flushPendingPayload = useCallback(
    (force = false) => {
      if (!pendingPayloadRef.current) {
        return;
      }

      const elapsed = Date.now() - lastApplyRef.current;
      if (!force && elapsed < UPDATE_THROTTLE_MS) {
        if (!applyTimeoutRef.current) {
          applyTimeoutRef.current = setTimeout(() => {
            applyTimeoutRef.current = null;
            flushPendingPayload();
          }, UPDATE_THROTTLE_MS - elapsed);
        }
        return;
      }

      const payload = pendingPayloadRef.current;
      pendingPayloadRef.current = null;
      if (!payload) {
        return;
      }

      if (
        payload.hash === lastRenderedHashRef.current &&
        payload.bounds === lastAppliedPayloadRef.current?.bounds &&
        payload.maxTotal === lastAppliedPayloadRef.current?.maxTotal
      ) {
        return;
      }

      drawPayload(payload);
      lastAppliedPayloadRef.current = payload;
      lastRenderedHashRef.current = payload.hash;
      lastApplyRef.current = Date.now();
    },
    [drawPayload]
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const syncCanvasSize = () => {
      const width = Math.max(0, Math.floor(container.clientWidth));
      const height = Math.max(0, Math.floor(container.clientHeight));
      const dpr = Math.max(window.devicePixelRatio || 1, 1);

      canvasWidthRef.current = width;
      canvasHeightRef.current = height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      drawPayload(lastAppliedPayloadRef.current);
    };

    const resizeObserver = new ResizeObserver(() => {
      syncCanvasSize();
    });

    resizeObserver.observe(container);
    syncCanvasSize();

    return () => {
      if (applyTimeoutRef.current) {
        clearTimeout(applyTimeoutRef.current);
      }

      resizeObserver.disconnect();

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvasWidthRef.current, canvasHeightRef.current);
      }

      pendingPayloadRef.current = null;
      lastAppliedPayloadRef.current = null;
      lastRenderedHashRef.current = "";
    };
  }, [canvasRef, containerRef, drawPayload]);

  useEffect(() => {
    pendingPayloadRef.current = null;
    lastAppliedPayloadRef.current = null;
    lastRenderedHashRef.current = "";

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvasWidthRef.current, canvasHeightRef.current);
    }
  }, [canvasRef, visibleRangeResetKey]);

  const updateDepthData = useCallback(
    (
      bids: DepthLevel[],
      asks: DepthLevel[],
      bounds: DepthRenderableBounds | null,
      maxTotal?: number
    ) => {
      const payload: DepthPayload = {
        bids,
        asks,
        bounds,
        maxTotal,
        hash: `${hashLevels(bids)}#${hashLevels(asks)}`,
      };

      if (
        payload.hash === pendingPayloadRef.current?.hash &&
        payload.bounds === pendingPayloadRef.current?.bounds &&
        payload.maxTotal === pendingPayloadRef.current?.maxTotal
      ) {
        return;
      }

      pendingPayloadRef.current = payload;
      flushPendingPayload();
    },
    [flushPendingPayload]
  );

  return {
    updateDepthData,
  };
}
