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

function dragMarker(axis: ResizeHandleAxis, active: ResizeHandleAxis | null): "" | undefined {
  return active === axis ? "" : undefined;
}

/** Centred short grip; colour-only fade so reduced motion needs no special case. */
const EDGE_PILL =
  "pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/0 transition-colors duration-150 group-hover:bg-foreground/25 group-data-[resizing]:bg-foreground/40";

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
      transition: isResizing || isDragged ? "none" : "box-shadow 120ms ease",
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
  const resizingAxis = isResizing ? activeCorner : null;

  return (
    <div
      ref={wrapperRef}
      className={`absolute panel-contain rounded-[var(--radius-panel)] bg-transparent overflow-hidden ${
        isResizing || isDragged ? "select-none shadow-[var(--shadow-e3)] z-50" : ""
      } ${isDragged ? "pointer-events-none" : ""} ${isDragged ? "opacity-30" : "opacity-100"} ${className}`}
      style={style}
      onPointerMove={handlePanelMouseMove}
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={handlePanelMouseLeave}
    >
      <div className="h-full w-full overflow-x-hidden overflow-y-auto rounded-[var(--radius-panel)]">
        {children}
      </div>

      {/* Inset ring rides the tier rim's arc, above it, so hover/drag adds no second edge. */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 z-10 rounded-[var(--radius-panel)] ring-1 ring-inset transition-shadow duration-150 ${
          isResizing || isDragged
            ? "ring-foreground/40"
            : isHovered
              ? "ring-foreground/25"
              : "ring-transparent"
        }`}
      />

      {/* Drag Handle — Grip icon for repositioning */}
      <div
        onPointerDown={(e) => onRepositionStart?.(id, e)}
        className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-8 h-5 cursor-grab active:cursor-grabbing transition-[opacity,background-color] duration-[120ms] rounded touch-none ${
          isActive && !isResizing ? "opacity-60" : "opacity-0"
        } hover:opacity-80 hover:bg-foreground/5`}
      >
        <GripHorizontal className="size-4 text-foreground/60" />
      </div>

      {/* Edge grips: 10px hit strips, short centred pill lit on hover and while dragging */}
      <div
        className="group absolute top-0 left-2.5 right-2.5 h-2.5 cursor-ns-resize z-10 touch-none"
        data-resizing={dragMarker("n", resizingAxis)}
        onPointerDown={handlePointerDown("n")}
      >
        <span className={`${EDGE_PILL} h-[3px] w-8`} />
      </div>
      <div
        className="group absolute bottom-0 left-2.5 right-2.5 h-2.5 cursor-ns-resize z-10 touch-none"
        data-resizing={dragMarker("s", resizingAxis)}
        onPointerDown={handlePointerDown("s")}
      >
        <span className={`${EDGE_PILL} h-[3px] w-8`} />
      </div>
      <div
        className="group absolute left-0 top-3 bottom-3 w-2.5 cursor-ew-resize z-10 touch-none"
        data-resizing={dragMarker("w", resizingAxis)}
        onPointerDown={handlePointerDown("w")}
      >
        <span className={`${EDGE_PILL} h-8 w-[3px]`} />
      </div>
      <div
        className="group absolute right-0 top-3 bottom-3 w-2.5 cursor-ew-resize z-10 touch-none"
        data-resizing={dragMarker("e", resizingAxis)}
        onPointerDown={handlePointerDown("e")}
      >
        <span className={`${EDGE_PILL} h-8 w-[3px]`} />
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
