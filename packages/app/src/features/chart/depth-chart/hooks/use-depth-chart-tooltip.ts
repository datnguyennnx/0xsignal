/**
 * @overview Depth Chart Tooltip Hook
 *
 * Provides high-performance, RAF-throttled tooltip state for the L2 depth chart.
 * Resolves hover price, cumulative volume, and "mirror" price (symmetric counterpart) for symmetric depth analysis.
 *
 * @mechanism
 * - utilizes requestAnimationFrame for mouse movement tracking to avoid UI lag.
 * - implements a "mirror search" logic to find the total volume at the same distance from center in the opposite side.
 * - uses a custom resolution engine (resolveDepthHover) to map canvas coordinates to price levels.
 */
import { useEffect, useRef, useState } from "react";
import type { DepthChartCanonicalFrame } from "./use-depth-chart-canonical-frame";
import type { DepthHoverModel, DepthSideSnapshot } from "../lib/depth-hover-model";
import { resolveDepthHover, resolveDepthSideSnapshotAtPrice } from "../lib/depth-hover-model";

export interface DepthTooltipState {
  hover: DepthHoverModel;
  mirror: DepthSideSnapshot | null;
  position: {
    left: number;
    top: number;
  };
  mirrorPosition: {
    left: number;
    top: number;
  } | null;
}

interface UseDepthChartTooltipOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  frame: DepthChartCanonicalFrame;
}

const TOOLTIP_WIDTH = 180;
const TOOLTIP_HEIGHT = 74;
const OFFSET_X = 10;
const OFFSET_Y = 12;

function resolveTooltipPosition(
  pointerX: number,
  pointerY: number,
  width: number,
  height: number,
  preferLeft = false
): { left: number; top: number } {
  let left = preferLeft ? pointerX - TOOLTIP_WIDTH - OFFSET_X : pointerX + OFFSET_X;
  let top = pointerY + OFFSET_Y;

  if (!preferLeft && left + TOOLTIP_WIDTH > width - 8) {
    left = pointerX - TOOLTIP_WIDTH - OFFSET_X;
  }
  if (preferLeft && left < 8) {
    left = pointerX + OFFSET_X;
  }
  if (left < 8) {
    left = 8;
  }

  if (top + TOOLTIP_HEIGHT > height - 8) {
    top = pointerY - TOOLTIP_HEIGHT - OFFSET_Y;
  }
  if (top < 8) {
    top = 8;
  }

  return { left, top };
}

export function useDepthChartTooltip({
  containerRef,
  frame,
}: UseDepthChartTooltipOptions): DepthTooltipState | null {
  const [tooltipState, setTooltipState] = useState<DepthTooltipState | null>(null);
  const rafRef = useRef<number | null>(null);
  const frameRef = useRef(frame);
  const lastHoverRef = useRef<DepthHoverModel | null>(null);
  const pointerRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 0,
    y: 0,
    active: false,
  });
  const updateFromPointerRef = useRef<((clientX: number, clientY: number) => void) | null>(null);

  useEffect(() => {
    frameRef.current = frame;
    if (!frame.hasRenderableFrame || !frame.bounds) {
      requestAnimationFrame(() => setTooltipState(null));
      lastHoverRef.current = null;
      return;
    }
    // Re-sync tooltip when realtime frame updates while pointer stays still.
    if (pointerRef.current.active && updateFromPointerRef.current) {
      const updater = updateFromPointerRef.current;
      requestAnimationFrame(() => updater(pointerRef.current.x, pointerRef.current.y));
    }
  }, [frame]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updateFromPointer = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const currentFrame = frameRef.current;
      if (!currentFrame.hasRenderableFrame || !currentFrame.bounds) {
        setTooltipState(null);
        return;
      }
      const hover = resolveDepthHover({
        x,
        width: rect.width,
        height: rect.height,
        bounds: currentFrame.bounds,
        bids: currentFrame.bids,
        asks: currentFrame.asks,
        bestBid: currentFrame.bestBid,
        bestAsk: currentFrame.bestAsk,
        maxTotal: currentFrame.maxTotal,
        tickSize: currentFrame.tickSize,
        topPadding: 12,
        bottomPadding: 24,
        previousHover: lastHoverRef.current,
      });

      if (!hover) {
        lastHoverRef.current = null;
        setTooltipState((current) => (current ? null : current));
        return;
      }
      lastHoverRef.current = hover;
      const mirror =
        !hover.isInSpreadGap && currentFrame.bounds
          ? resolveDepthSideSnapshotAtPrice(
              hover.side === "bids" ? "asks" : "bids",
              hover.side === "bids" ? currentFrame.asks : currentFrame.bids,
              currentFrame.bounds.centerPrice * 2 - hover.price,
              {
                bounds: currentFrame.bounds,
                oppositeLevels: hover.side === "bids" ? currentFrame.bids : currentFrame.asks,
                width: rect.width,
                height: rect.height,
                maxTotal: currentFrame.maxTotal,
                tickSize: currentFrame.tickSize,
                topPadding: 12,
                bottomPadding: 24,
              }
            )
          : null;

      const anchorX = hover.canvasPoint?.x ?? x;
      const anchorY = hover.canvasPoint?.y ?? y;
      const position = resolveTooltipPosition(
        anchorX,
        anchorY,
        rect.width,
        rect.height,
        hover.side === "asks"
      );
      const mirrorPosition = mirror
        ? (() => {
            const mirrorX = mirror.canvasPoint?.x ?? x;
            const mirrorY = mirror.canvasPoint?.y ?? y;
            return resolveTooltipPosition(
              mirrorX,
              mirrorY,
              rect.width,
              rect.height,
              mirror.side === "asks"
            );
          })()
        : null;
      setTooltipState((current) => {
        if (
          current &&
          current.hover.side === hover.side &&
          current.hover.price === hover.price &&
          current.hover.cumulative === hover.cumulative &&
          current.hover.isInSpreadGap === hover.isInSpreadGap &&
          current.mirror?.cumulative === mirror?.cumulative &&
          Math.abs(current.position.left - position.left) < 1 &&
          Math.abs(current.position.top - position.top) < 1 &&
          ((current.mirrorPosition === null && mirrorPosition === null) ||
            (current.mirrorPosition !== null &&
              mirrorPosition !== null &&
              Math.abs(current.mirrorPosition.left - mirrorPosition.left) < 1 &&
              Math.abs(current.mirrorPosition.top - mirrorPosition.top) < 1))
        ) {
          return current;
        }
        return { hover, mirror, position, mirrorPosition };
      });
    };
    updateFromPointerRef.current = updateFromPointer;

    const onMouseMove = (event: MouseEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, active: true };
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateFromPointer(event.clientX, event.clientY);
      });
    };

    const onMouseLeave = () => {
      pointerRef.current.active = false;
      lastHoverRef.current = null;
      setTooltipState(null);
    };

    container.addEventListener("mousemove", onMouseMove);
    container.addEventListener("mouseleave", onMouseLeave);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      updateFromPointerRef.current = null;
      container.removeEventListener("mousemove", onMouseMove);
      container.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [containerRef]);

  return tooltipState;
}
