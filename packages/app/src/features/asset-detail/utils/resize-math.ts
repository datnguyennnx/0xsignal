import type { ResizeFrame, ResizeHandleAxis, ResizeLimits } from "./types";

function clampSpan(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

export function computeResizeFrame(
  axis: ResizeHandleAxis,
  start: ResizeFrame,
  snappedDx: number,
  snappedDy: number,
  limits: ResizeLimits,
): ResizeFrame {
  const { minW, minH, minX, maxX, minY, maxRows } = limits;
  const startRight = start.x + start.w;
  const startBottom = start.y + start.h;

  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;

  if (axis.includes("e")) {
    w = clampSpan(start.w + snappedDx, minW, maxX - x);
  } else if (axis.includes("w")) {
    x = clampSpan(start.x + snappedDx, minX, startRight - minW);
    w = startRight - x;
  }

  if (axis.includes("s")) {
    h = clampSpan(start.h + snappedDy, minH, maxRows - start.y);
  } else if (axis.includes("n")) {
    y = clampSpan(start.y + snappedDy, minY, startBottom - minH);
    h = startBottom - y;
  }

  return { x, y, w, h };
}
