import { useRef, useState, useCallback, useEffect } from "react";
import { GripHorizontal } from "lucide-react";
import type { LayoutItem } from "../utils/types";
import { GRID_ROW_HEIGHT, GRID_GUTTER } from "../utils/constants";
import { cellWidth } from "../utils/collision";
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

const TOUCH_NONE = { touchAction: "none" } as const;

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

  const cw = cellWidth(containerWidth);
  const ch = GRID_ROW_HEIGHT;
  const GUTTER = GRID_GUTTER;

  // Use ghost overrides during drag, real item dimensions otherwise
  const displayW = ghost?.w ?? item.w;
  const displayH = ghost?.h ?? item.h;
  const displayX = ghost?.x ?? item.x;
  const displayY = ghost?.y ?? item.y;

  const left = displayX * (cw + GUTTER);
  const top = displayY * (ch + GUTTER);
  const width = displayW * cw + (displayW - 1) * GUTTER;
  const height = displayH * ch + (displayH - 1) * GUTTER;

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
      className={`absolute rounded-xl border bg-card overflow-hidden ${
        isResizing || isDragged
          ? "select-none border-foreground/30 shadow-xl z-50"
          : "border-border/20"
      } ${isDragged ? "pointer-events-none" : ""} ${isHovered && !isResizing && !isDragged ? "border-foreground/10" : ""} ${className}`}
      style={{
        transform: `translate(${left}px, ${top}px)`,
        width: `${width}px`,
        height: `${height}px`,
        opacity: isDragged ? 0.3 : 1,
        transition: isResizing
          ? "box-shadow 150ms ease, border-color 150ms ease, opacity 150ms ease"
          : "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), width 200ms cubic-bezier(0.34, 1.56, 0.64, 1), height 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease, border-color 200ms ease, opacity 150ms ease",
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
        className={`absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-8 h-5 cursor-grab active:cursor-grabbing transition-all duration-150 rounded ${
          isActive && !isResizing ? "opacity-60" : "opacity-0"
        } hover:opacity-80 hover:bg-foreground/5`}
        style={TOUCH_NONE}
      >
        <GripHorizontal className="size-4 text-foreground/60" />
      </div>

      {/* Edge resize hitboxes — invisible strips with directional cursors */}
      {!isResizing && !isDragged && (
        <>
          {/* Left edge */}
          <div
            className="absolute left-0 top-2.5 bottom-2.5 w-[6px] cursor-ew-resize z-10"
            style={TOUCH_NONE}
            onPointerDown={handlePointerDown("w")}
          />
          {/* Right edge */}
          <div
            className="absolute right-0 top-2.5 bottom-2.5 w-[6px] cursor-ew-resize z-10"
            style={TOUCH_NONE}
            onPointerDown={handlePointerDown("e")}
          />
          {/* Top edge */}
          <div
            className="absolute top-0 left-2.5 right-2.5 h-[6px] cursor-ns-resize z-10"
            style={TOUCH_NONE}
            onPointerDown={handlePointerDown("n")}
          />
          {/* Bottom edge */}
          <div
            className="absolute bottom-0 left-2.5 right-2.5 h-[6px] cursor-ns-resize z-10"
            style={TOUCH_NONE}
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
