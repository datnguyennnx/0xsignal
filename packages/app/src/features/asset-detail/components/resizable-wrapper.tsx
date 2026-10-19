import { useRef, useState, useCallback, useEffect } from "react";
import { GripHorizontal } from "lucide-react";
import type { LayoutItem } from "../utils/types";
import { GRID_ROW_PITCH_CSS } from "../utils/constants";
import { cellWidth, GRID_GUTTER_FRACTION } from "../utils/collision";
import { useResizeGesture } from "../hooks/use-resize-gesture";
import { CornerHandles } from "./corner-handles";

interface ResizableWrapperProps {
  id: string;
  children: React.ReactNode;
  item: LayoutItem;
  containerWidth: number;
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

export function ResizableWrapper({
  id,
  children,
  item,
  containerWidth,
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

  // Resize gesture hook (extracted for separation of concerns)
  const {
    ghost,
    isResizing,
    activeCorner,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePanelMouseMove,
    handlePanelMouseLeave: onGestureLeave,
  } = useResizeGesture({
    id,
    item,
    containerWidth,
    maxW,
    maxH,
    minX,
    minY,
    isDragged,
    onResizeCommit,
  });

  const cw = cellWidth();
  const cellStep = cw + GRID_GUTTER_FRACTION;

  // Use ghost overrides during drag, real item dimensions otherwise
  const displayW = ghost?.w ?? item.w;
  const displayH = ghost?.h ?? item.h;
  const displayX = ghost?.x ?? item.x;
  const displayY = ghost?.y ?? item.y;

  // Horizontal geometry is container-relative (fractions → %). Vertical uses the
  // shared fluid row pitch so the panel matches the container/preview geometry.
  const left = displayX * cellStep * containerWidth;
  const top = `calc(${displayY} * ${GRID_ROW_PITCH_CSS})`;
  const widthFraction = displayW * cw + (displayW - 1) * GRID_GUTTER_FRACTION;
  const heightCalc = `calc(${displayH} * var(--grid-row-height) + ${displayH - 1} * 0.5rem)`;

  // Combined leave handler: gesture cleanup + hover state
  const handlePanelMouseLeave = useCallback(() => {
    onGestureLeave();
    setIsHovered(false);
  }, [onGestureLeave]);

  // Body cursor lock during drag — prevents cursor flicker when
  // the original element has pointer-events: none
  useEffect(() => {
    if (isDragged) {
      document.documentElement.dataset.resizeCursor = "grabbing";
      return () => {
        delete document.documentElement.dataset.resizeCursor;
      };
    }
  }, [isDragged]);

  // Cleanup cursor on unmount (belt-and-suspenders)
  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.resizeCursor;
    };
  }, []);

  const isActive = isResizing || isDragged || isHovered;

  return (
    <div
      ref={wrapperRef}
      className={`absolute rounded-xl border bg-transparent overflow-hidden ${
        isResizing || isDragged
          ? "select-none border-foreground/40 shadow-xl z-50"
          : "border-transparent"
      } ${isDragged ? "pointer-events-none" : ""} ${isHovered && !isResizing && !isDragged ? "border-foreground/20" : ""} ${isDragged ? "opacity-30" : "opacity-100"} ${className}`}
      style={{
        transform: `translateX(${left}px)`,
        top,
        width: `${widthFraction * 100}%`,
        height: heightCalc,
        transition: isResizing
          ? "box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease"
          : "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), top 200ms cubic-bezier(0.34, 1.56, 0.64, 1), width 200ms cubic-bezier(0.34, 1.56, 0.64, 1), height 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease, border-color 200ms ease, opacity 150ms ease",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handlePanelMouseLeave}
      onMouseMove={handlePanelMouseMove}
    >
      <div className="h-full w-full overflow-hidden rounded-xl">{children}</div>

      {/* Drag Handle — Grip icon for repositioning */}
      <div
        onPointerDown={(e) => onRepositionStart?.(id, e)}
        className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-8 h-5 cursor-grab active:cursor-grabbing transition-[opacity,background-color] duration-150 rounded touch-none ${
          isActive && !isResizing ? "opacity-60" : "opacity-0"
        } hover:opacity-80 hover:bg-foreground/5`}
      >
        <GripHorizontal className="size-4 text-foreground/60" />
      </div>

      {/* Edge resize hitboxes — invisible strips with directional cursors */}
      {!isResizing && !isDragged && (
        <>
          {/* Left edge */}
          <div
            className="absolute left-0 top-2.5 bottom-2.5 w-1.5 cursor-ew-resize z-10 touch-none"
            onPointerDown={handlePointerDown("w")}
          />
          {/* Right edge */}
          <div
            className="absolute right-0 top-2.5 bottom-2.5 w-1.5 cursor-ew-resize z-10 touch-none"
            onPointerDown={handlePointerDown("e")}
          />
          {/* Top edge */}
          <div
            className="absolute top-0 left-2.5 right-2.5 h-1.5 cursor-ns-resize z-10 touch-none"
            onPointerDown={handlePointerDown("n")}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-2.5 right-2.5 h-1.5 cursor-ns-resize z-10 touch-none"
            onPointerDown={handlePointerDown("s")}
          />
        </>
      )}

      {/* Resize handles — L-shaped corner brackets shown near corners */}
      {activeCorner && (
        <CornerHandles
          activeCorner={activeCorner}
          isResizing={isResizing}
          onPointerDown={handlePointerDown}
        />
      )}
    </div>
  );
}
