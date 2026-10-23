import { memo, useRef, useState, useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { GripHorizontal } from "lucide-react";
import type { LayoutItem, ResizeHandleAxis } from "../utils/types";
import { GRID_ROW_PITCH_CSS } from "../utils/constants";
import { cellWidth, GRID_GUTTER_FRACTION } from "../utils/collision";
import { useResizeGesture, type ResizeFrame } from "../hooks/use-resize-gesture";
import { CornerHandles } from "./corner-handles";

interface ResizableWrapperProps {
  id: string;
  children: React.ReactNode;
  item: LayoutItem;
  containerWidth: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  minX?: number;
  minY?: number;
  onResizeCommit: (id: string, x: number, y: number, w: number, h: number) => void;
  /** Called when the drag handle is pressed */
  onRepositionStart?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  /** Whether this panel is currently being dragged */
  isDragged?: boolean;
  className?: string;
}

interface FrameCss {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
}

function isCornerAxis(axis: ResizeHandleAxis): boolean {
  return axis === "nw" || axis === "ne" || axis === "sw" || axis === "se";
}

/**
 * Horizontal geometry is container-relative (fractions → %); vertical uses the
 * shared fluid row pitch. Percentage `left` (not a px transform) resolves against
 * the grid container, so a panel lands on its final X on the very first paint.
 */
function frameCss({ x, y, w, h }: ResizeFrame): FrameCss {
  const cw = cellWidth();
  const cellStep = cw + GRID_GUTTER_FRACTION;
  return {
    left: `${x * cellStep * 100}%`,
    top: `calc(${y} * ${GRID_ROW_PITCH_CSS})`,
    width: `${(w * cw + (w - 1) * GRID_GUTTER_FRACTION) * 100}%`,
    height: `calc(${h} * var(--grid-row-height) + ${h - 1} * 0.5rem)`,
  };
}

/**
 * The single geometry writer. The gesture paints through this function and React
 * renders through it too, so the live ghost and the committed frame cannot drift.
 */
function writeFrame(el: HTMLElement, frame: ResizeFrame): void {
  const css = frameCss(frame);
  el.style.left = css.left;
  el.style.top = css.top;
  el.style.width = css.width;
  el.style.height = css.height;
}

export const ResizableWrapper = memo(function ResizableWrapper({
  id,
  children,
  item,
  containerWidth,
  minW,
  minH,
  maxW,
  maxH,
  minX = 0,
  minY = 0,
  onResizeCommit,
  onRepositionStart,
  isDragged = false,
  className = "",
}: ResizableWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const applyFrame = useCallback((frame: ResizeFrame) => {
    const el = wrapperRef.current;
    if (el !== null) writeFrame(el, frame);
  }, []);

  const {
    isResizing,
    activeCorner,
    handlePointerDown,
    handlePanelMouseMove,
    handlePanelMouseLeave: onGestureLeave,
  } = useResizeGesture({
    id,
    item,
    containerWidth,
    minW,
    minH,
    maxW,
    maxH,
    minX,
    minY,
    isDragged,
    applyFrame,
    onResizeCommit,
  });

  // Committed geometry only: the live gesture writes to the element directly, so
  // this object stays referentially stable while a panel is being resized.
  const geometry = useMemo<FrameCss>(
    () => frameCss({ x: item.x, y: item.y, w: item.w, h: item.h }),
    [item.x, item.y, item.w, item.h],
  );

  // Geometry snaps; only chrome fades, and only while idle.
  const style = useMemo<CSSProperties>(
    () => ({
      ...geometry,
      transition:
        isResizing || isDragged ? "none" : "box-shadow 120ms ease, border-color 120ms ease",
    }),
    [geometry, isResizing, isDragged],
  );

  const handlePanelMouseLeave = useCallback(() => {
    onGestureLeave();
    setIsHovered(false);
  }, [onGestureLeave]);

  useEffect(() => {
    const root = document.documentElement;
    if (!isDragged) return () => {};
    const previous = root.style.cursor;
    root.style.cursor = "grabbing";
    return () => {
      root.style.cursor = previous;
    };
  }, [isDragged]);

  const isActive = isResizing || isDragged || isHovered;

  return (
    <div
      ref={wrapperRef}
      className={`absolute panel-contain rounded-xl border bg-transparent overflow-hidden ${
        isResizing || isDragged
          ? "select-none border-foreground/40 shadow-xl z-50"
          : "border-transparent"
      } ${isDragged ? "pointer-events-none" : ""} ${isHovered && !isResizing && !isDragged ? "border-foreground/20" : ""} ${isDragged ? "opacity-30" : "opacity-100"} ${className}`}
      style={style}
      onPointerMove={handlePanelMouseMove}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={handlePanelMouseLeave}
    >
      <div className="h-full w-full overflow-x-hidden overflow-y-auto rounded-xl">{children}</div>

      {/* Drag Handle — Grip icon for repositioning */}
      <div
        onPointerDown={(e) => onRepositionStart?.(id, e)}
        className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-8 h-5 cursor-grab active:cursor-grabbing transition-[opacity,background-color] duration-[120ms] rounded touch-none ${
          isActive && !isResizing ? "opacity-60" : "opacity-0"
        } hover:opacity-80 hover:bg-foreground/5`}
      >
        <GripHorizontal className="size-4 text-foreground/60" />
      </div>

      {/* Edge resize handles — 10px hit area, visible only while idle */}
      <div
        className="group absolute top-0 left-2.5 right-2.5 h-2.5 cursor-ns-resize z-10 touch-none"
        onPointerDown={handlePointerDown("n")}
      >
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-foreground/0 transition-colors duration-150 group-hover:bg-foreground/25" />
      </div>
      <div
        className="group absolute bottom-0 left-2.5 right-2.5 h-2.5 cursor-ns-resize z-10 touch-none"
        onPointerDown={handlePointerDown("s")}
      >
        <span className="pointer-events-none absolute inset-x-0 bottom-1/2 h-0.5 translate-y-1/2 rounded-full bg-foreground/0 transition-colors duration-150 group-hover:bg-foreground/25" />
      </div>

      {/* Resize handles — L-shaped corner brackets shown near corners */}
      {activeCorner !== null && isCornerAxis(activeCorner) && (
        <CornerHandles
          activeCorner={activeCorner}
          isResizing={isResizing}
          onPointerDown={handlePointerDown}
        />
      )}
    </div>
  );
});

ResizableWrapper.displayName = "ResizableWrapper";
