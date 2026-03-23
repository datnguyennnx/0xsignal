import { useEffect, useRef } from "react";
import type { DepthChartCanonicalFrame } from "./use-depth-chart-canonical-frame";
import type { DepthTooltipState } from "./use-depth-chart-tooltip";
import { mapPriceToCanvasX } from "../lib/depth-canvas-mapping";

interface UseDepthChartOverlayEngineOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  overlayCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  frame: DepthChartCanonicalFrame;
  tooltip: DepthTooltipState | null;
  isDark: boolean;
}

function syncCanvasSize(canvas: HTMLCanvasElement, width: number, height: number): void {
  const dpr = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

export function useDepthChartOverlayEngine({
  containerRef,
  overlayCanvasRef,
  frame,
  tooltip,
  isDark,
}: UseDepthChartOverlayEngineOptions): void {
  const widthRef = useRef(0);
  const heightRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = overlayCanvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const resize = () => {
      widthRef.current = Math.max(0, Math.floor(container.clientWidth));
      heightRef.current = Math.max(0, Math.floor(container.clientHeight));
      syncCanvasSize(canvas, widthRef.current, heightRef.current);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [containerRef, overlayCanvasRef]);

  useEffect(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = widthRef.current;
    const height = heightRef.current;
    ctx.clearRect(0, 0, width, height);

    if (!tooltip || !frame.bounds || !frame.hasRenderableFrame) {
      return;
    }

    const topPadding = 12;
    const bottomPadding = 24;
    const guideTop = topPadding;
    const guideBottom = Math.max(height - bottomPadding, guideTop);
    const hover = tooltip.hover;
    const guideX =
      hover.canvasPoint?.x ?? mapPriceToCanvasX(hover.price, { bounds: frame.bounds, width });
    const greyFill = isDark ? "rgba(148,163,184,0.06)" : "rgba(100,116,139,0.08)";
    const greyStroke = isDark ? "rgba(148,163,184,0.58)" : "rgba(71,85,105,0.52)";
    const greyMarker = isDark ? "rgba(203,213,225,0.95)" : "rgba(71,85,105,0.95)";
    const minorBandHalfWidth = 14;

    if (hover.isInSpreadGap) {
      const fromX = mapPriceToCanvasX(hover.hoveredPriceBand.from, {
        bounds: frame.bounds,
        width,
      });
      const toX = mapPriceToCanvasX(hover.hoveredPriceBand.to, {
        bounds: frame.bounds,
        width,
      });
      ctx.fillStyle = greyFill;
      ctx.fillRect(Math.min(fromX, toX), guideTop, Math.abs(toX - fromX), guideBottom - guideTop);
      ctx.strokeStyle = greyStroke;
    } else {
      const left = Math.max(0, guideX - minorBandHalfWidth);
      const right = Math.min(width, guideX + minorBandHalfWidth);
      ctx.fillStyle = greyFill;
      ctx.fillRect(left, guideTop, right - left, guideBottom - guideTop);
      ctx.strokeStyle = greyStroke;
    }

    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(guideX + 0.5, guideTop);
    ctx.lineTo(guideX + 0.5, guideBottom);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!hover.isInSpreadGap && hover.canvasPoint) {
      ctx.fillStyle = greyMarker;
      ctx.beginPath();
      ctx.arc(hover.canvasPoint.x, hover.canvasPoint.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isDark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.72)";
      ctx.lineWidth = 1;
      ctx.stroke();

      if (tooltip.mirror) {
        const mirrorX =
          tooltip.mirror.canvasPoint?.x ??
          mapPriceToCanvasX(tooltip.mirror.price, { bounds: frame.bounds, width });
        const mirrorY = tooltip.mirror.canvasPoint?.y ?? hover.canvasPoint.y;

        const mirrorLeft = Math.max(0, mirrorX - minorBandHalfWidth);
        const mirrorRight = Math.min(width, mirrorX + minorBandHalfWidth);
        ctx.fillStyle = greyFill;
        ctx.fillRect(mirrorLeft, guideTop, mirrorRight - mirrorLeft, guideBottom - guideTop);

        ctx.fillStyle = greyMarker;
        ctx.beginPath();
        ctx.arc(mirrorX, mirrorY, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [frame, isDark, overlayCanvasRef, tooltip]);
}
