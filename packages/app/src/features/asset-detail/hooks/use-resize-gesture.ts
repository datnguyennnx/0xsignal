import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { LayoutItem, ResizeHandleAxis } from "../utils/types";
import { GRID_COLS, GRID_ROW_HEIGHT } from "../utils/constants";
import { cellWidth, snapToGridUnits } from "../utils/collision";

// Gesture State
// Only 'resize' variant — reposition is handled by useLiftAndFloat

type GestureState = {
  kind: "resize";
  axis: ResizeHandleAxis;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
  startItemX: number;
  startItemY: number;
  lastSnappedW: number;
  lastSnappedH: number;
  lastSnappedX: number;
  lastSnappedY: number;
};

// Ghost State (visual re-render during drag)

interface GhostState {
  w?: number;
  h?: number;
  x?: number;
  y?: number;
}

// Cursor Helpers

/** Map a resize handle axis to its CSS cursor name */
function cursorForAxis(axis: ResizeHandleAxis): string {
  switch (axis) {
    case "e":
    case "w":
      return "ew-resize";
    case "n":
    case "s":
      return "ns-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
  }
}

// Hook Options & Return

interface UseResizeGestureOptions {
  id: string;
  item: LayoutItem;
  containerWidth: number;
  maxW: number;
  maxH: number;
  minX: number;
  minY: number;
  isDragged: boolean;
  onResizeCommit: (id: string, x: number, y: number, w: number, h: number) => void;
}

interface UseResizeGestureReturn {
  ghost: GhostState | null;
  isResizing: boolean;
  activeCorner: ResizeHandleAxis | null;
  handlePointerDown: (axis: ResizeHandleAxis) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  handlePointerUp: () => void;
  handlePanelMouseMove: (e: React.MouseEvent) => void;
  handlePanelMouseLeave: () => void;
}

// Hook

export function useResizeGesture({
  id,
  item,
  containerWidth,
  maxW,
  maxH,
  minX,
  minY,
  isDragged,
  onResizeCommit,
}: UseResizeGestureOptions): UseResizeGestureReturn {
  const gestureRef = useRef<GestureState | null>(null);
  const activeCornerRef = useRef<ResizeHandleAxis | null>(null);
  const resizeCursorRef = useRef<string | null>(null);

  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [activeCorner, setActiveCorner] = useState<ResizeHandleAxis | null>(null);

  // Grid measurements
  const cw = cellWidth(containerWidth);
  const ch = GRID_ROW_HEIGHT;

  // Resize Handler

  // Sync resize cursor to document root via effect (avoids direct DOM mutation in callbacks)
  useEffect(() => {
    const cursor = resizeCursorRef.current;
    if (cursor) {
      document.documentElement.dataset.resizeCursor = cursor;
    } else {
      delete document.documentElement.dataset.resizeCursor;
    }
  });

  // Cleanup cursor on unmount
  useEffect(() => {
    return () => {
      delete document.documentElement.dataset.resizeCursor;
    };
  }, []);

  const handlePointerDown = useCallback(
    (axis: ResizeHandleAxis) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      target.setPointerCapture(e.pointerId);

      gestureRef.current = {
        kind: "resize",
        axis,
        startX: e.clientX,
        startY: e.clientY,
        startW: item.w,
        startH: item.h,
        startItemX: item.x,
        startItemY: item.y,
        lastSnappedW: item.w,
        lastSnappedH: item.h,
        lastSnappedX: item.x,
        lastSnappedY: item.y,
      };

      // Initialize ghost to current item dimensions
      setGhost({ w: item.w, h: item.h, x: item.x, y: item.y });
      setIsResizing(true);

      // Lock cursor via CSS class on root element (avoids direct style mutation)
      resizeCursorRef.current = cursorForAxis(axis);
    },
    [item.w, item.h, item.x, item.y]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.kind !== "resize") return;

      const { axis, startX, startY, startW, startH, startItemX, startItemY } = gesture;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const snappedDx = snapToGridUnits(dx, cw);
      const snappedDy = snapToGridUnits(dy, ch);

      let proposedX = startItemX;
      let proposedY = startItemY;
      let proposedW = startW;
      let proposedH = startH;

      const minW = item.minW ?? 1;
      const minH = item.minH ?? 1;

      // Horizontal: 'e' = right edge moves, 'w' = left edge moves
      if (axis.includes("e")) {
        proposedW = Math.max(
          minW,
          Math.min(startW + snappedDx, Math.min(maxW, GRID_COLS - proposedX))
        );
      }
      if (axis.includes("w")) {
        proposedX = startItemX + snappedDx;
        proposedW = startItemX + startW - proposedX;
        // Clamp: can't go past minX (neighbor collision) or make w < minW
        proposedX = Math.max(minX, Math.min(proposedX, startItemX + startW - minW));
        proposedW = startItemX + startW - proposedX;
      }

      // Vertical: 's' = bottom edge moves, 'n' = top edge moves
      if (axis.includes("s")) {
        proposedH = Math.max(minH, Math.min(startH + snappedDy, maxH));
      }
      if (axis.includes("n")) {
        proposedY = startItemY + snappedDy;
        proposedH = startItemY + startH - proposedY;
        // Clamp: can't go past minY (neighbor collision) or make h < minH
        proposedY = Math.max(minY, Math.min(proposedY, startItemY + startH - minH));
        proposedH = startItemY + startH - proposedY;
      }

      // Skip if no change from last frame
      if (
        proposedW === gesture.lastSnappedW &&
        proposedH === gesture.lastSnappedH &&
        proposedX === gesture.lastSnappedX &&
        proposedY === gesture.lastSnappedY
      )
        return;

      setGhost({ w: proposedW, h: proposedH, x: proposedX, y: proposedY });
      gestureRef.current = {
        ...gesture,
        lastSnappedW: proposedW,
        lastSnappedH: proposedH,
        lastSnappedX: proposedX,
        lastSnappedY: proposedY,
      };
    },
    [item.minW, item.minH, maxW, maxH, minX, minY, cw, ch]
  );

  const handlePointerUp = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.kind !== "resize") return;

    const { lastSnappedX, lastSnappedY, lastSnappedW, lastSnappedH } = gesture;
    // Fallback to item values if gesture doesn't have snapped values
    const commitX = lastSnappedX ?? item.x;
    const commitY = lastSnappedY ?? item.y;
    const commitW = lastSnappedW ?? item.w;
    const commitH = lastSnappedH ?? item.h;

    // Clear cursor class
    resizeCursorRef.current = null;

    gestureRef.current = null;
    setGhost(null);
    setIsResizing(false);

    if (commitX !== item.x || commitY !== item.y || commitW !== item.w || commitH !== item.h) {
      onResizeCommit(id, commitX, commitY, commitW, commitH);
    }
  }, [id, item, onResizeCommit]);

  // Corner Detection

  const handlePanelMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isResizing || isDragged) {
        if (isResizing && gestureRef.current?.kind === "resize") {
          if (activeCornerRef.current !== gestureRef.current.axis) {
            setActiveCorner(gestureRef.current.axis);
            activeCornerRef.current = gestureRef.current.axis;
          }
        } else {
          setActiveCorner(null);
          activeCornerRef.current = null;
        }
        return;
      }

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (!rect) return;

      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { width: rw, height: rh } = rect;

      const corners: { axis: ResizeHandleAxis; cx: number; cy: number }[] = [
        { axis: "nw", cx: 0, cy: 0 },
        { axis: "ne", cx: rw, cy: 0 },
        { axis: "sw", cx: 0, cy: rh },
        { axis: "se", cx: rw, cy: rh },
      ];

      const threshold = 52; // px — distance threshold for activation
      let closest: ResizeHandleAxis | null = null;
      let minDist = threshold;

      for (const { axis, cx, cy } of corners) {
        const dist = Math.hypot(mx - cx, my - cy);
        if (dist < minDist) {
          minDist = dist;
          closest = axis;
        }
      }

      setActiveCorner(closest);
      activeCornerRef.current = closest;
    },
    [isResizing, isDragged]
  );

  const handlePanelMouseLeave = useCallback(() => {
    if (!isResizing) setActiveCorner(null);
  }, [isResizing]);

  return {
    ghost,
    isResizing,
    activeCorner,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePanelMouseMove,
    handlePanelMouseLeave,
  };
}
