import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { LayoutItem, ResizeHandleAxis } from "../utils/types";
import { cellWidth, snapToGridUnits } from "../utils/collision";
import { readRowPitchPx } from "../utils/row-pitch";

/**
 * Corner grab box edge in px, and the size the corner wrapper is rendered at, so the
 * bracket is visible exactly where it can be grabbed. A radial proximity showed a
 * bracket the pointer could not grab.
 */
export const CORNER_HIT_BOX_PX = 24;

const CURSOR_BY_AXIS: Record<ResizeHandleAxis, string> = {
  n: "ns-resize",
  s: "ns-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
};

/** Panel geometry in grid cells. Always integral and inside the panel's limits. */
export interface ResizeFrame {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface GestureLimits {
  minW: number;
  minH: number;
  /** Edge coordinates the frame may not cross; see `getResizeBounds`. */
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Everything a gesture needs, snapshotted at pointerdown so listeners never read props. */
interface GestureState {
  id: string;
  axis: ResizeHandleAxis;
  pointerId: number;
  captureEl: HTMLElement;
  startX: number;
  startY: number;
  containerWidth: number;
  rowPitch: number;
  committed: ResizeFrame;
  limits: GestureLimits;
  frame: ResizeFrame;
}

interface WindowHandlers {
  move: (e: PointerEvent) => void;
  up: (e: PointerEvent) => void;
  cancel: (e: PointerEvent) => void;
  lostCapture: (e: PointerEvent) => void;
  key: (e: KeyboardEvent) => void;
  blur: () => void;
  contextMenu: (e: Event) => void;
}

interface UseResizeGestureOptions {
  id: string;
  item: LayoutItem;
  containerWidth: number;
  minW: number;
  minH: number;
  maxW: number;
  maxH: number;
  minX: number;
  minY: number;
  isDragged: boolean;
  /** Imperative geometry writer; the committed frame goes through the same path. */
  applyFrame: (frame: ResizeFrame) => void;
  onResizeCommit: (id: string, x: number, y: number, w: number, h: number) => void;
}

interface UseResizeGestureReturn {
  isResizing: boolean;
  activeCorner: ResizeHandleAxis | null;
  handlePointerDown: (axis: ResizeHandleAxis) => (e: ReactPointerEvent<HTMLDivElement>) => void;
  handlePanelMouseMove: (e: React.MouseEvent) => void;
  handlePanelMouseLeave: () => void;
}

function clampSpan(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

function sameFrame(a: ResizeFrame, b: ResizeFrame): boolean {
  return a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
}

/** Distance from a point to a grab box; 0 means the point is inside it. */
function distanceToBox(px: number, py: number, boxX: number, boxY: number, size: number): number {
  const dx = Math.max(boxX - px, 0, px - (boxX + size));
  const dy = Math.max(boxY - py, 0, py - (boxY + size));
  return Math.hypot(dx, dy);
}

function computeFrame(gesture: GestureState, clientX: number, clientY: number): ResizeFrame {
  const { minW, minH, minX, maxX, minY, maxY } = gesture.limits;
  const start = gesture.committed;
  const startRight = start.x + start.w;
  const startBottom = start.y + start.h;

  const snappedDx = snapToGridUnits(
    (clientX - gesture.startX) / gesture.containerWidth,
    cellWidth(),
  );
  const snappedDy = Math.round((clientY - gesture.startY) / gesture.rowPitch);

  let x = start.x;
  let y = start.y;
  let w = start.w;
  let h = start.h;

  // Each axis owns one moving edge and one pinned edge, so an edge handle and a
  // corner are the same two clamps against the same bounds.
  if (gesture.axis.includes("e")) {
    w = clampSpan(start.w + snappedDx, minW, maxX - x);
  } else if (gesture.axis.includes("w")) {
    x = clampSpan(start.x + snappedDx, minX, startRight - minW);
    w = startRight - x;
  }

  if (gesture.axis.includes("s")) {
    h = clampSpan(start.h + snappedDy, minH, maxY - y);
  } else if (gesture.axis.includes("n")) {
    y = clampSpan(start.y + snappedDy, minY, startBottom - minH);
    h = startBottom - y;
  }

  return { x, y, w, h };
}

/**
 * Page-level cursor/selection lock. Counted, because two pointers can resize two
 * panels at once and the first release must not clear the other's cursor.
 */
let activeGestures = 0;

function lockPageInteraction(axis: ResizeHandleAxis): void {
  activeGestures += 1;
  document.documentElement.style.cursor = CURSOR_BY_AXIS[axis];
  document.body.style.userSelect = "none";
}

function unlockPageInteraction(): void {
  activeGestures = Math.max(0, activeGestures - 1);
  if (activeGestures > 0) return;
  document.documentElement.style.cursor = "";
  document.body.style.userSelect = "";
}

export function useResizeGesture({
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
}: UseResizeGestureOptions): UseResizeGestureReturn {
  const gestureRef = useRef<GestureState | null>(null);
  const handlersRef = useRef<WindowHandlers | null>(null);

  // Latest pointer position and the frame that will be painted in the same tick.
  const pendingMoveRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const moveFrameRef = useRef(0);

  const pendingHoverRef = useRef<{ el: Element; clientX: number; clientY: number } | null>(null);
  const hoverFrameRef = useRef(0);
  const activeCornerRef = useRef<ResizeHandleAxis | null>(null);

  // Callbacks are read through refs so the window listeners never go stale.
  const applyFrameRef = useRef(applyFrame);
  const commitRef = useRef(onResizeCommit);

  const [isResizing, setIsResizing] = useState(false);
  const [activeCorner, setActiveCorner] = useState<ResizeHandleAxis | null>(null);

  useEffect(() => {
    applyFrameRef.current = applyFrame;
    commitRef.current = onResizeCommit;
  });

  const detachWindowListeners = useCallback(() => {
    const handlers = handlersRef.current;
    if (handlers === null) return;
    handlersRef.current = null;
    window.removeEventListener("pointermove", handlers.move, true);
    window.removeEventListener("pointerup", handlers.up, true);
    window.removeEventListener("pointercancel", handlers.cancel, true);
    window.removeEventListener("lostpointercapture", handlers.lostCapture, true);
    window.removeEventListener("keydown", handlers.key, true);
    window.removeEventListener("blur", handlers.blur);
    window.removeEventListener("contextmenu", handlers.contextMenu, true);
  }, []);

  const flushMove = useCallback(() => {
    moveFrameRef.current = 0;
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    const gesture = gestureRef.current;
    if (pending === null || gesture === null) return;

    const frame = computeFrame(gesture, pending.clientX, pending.clientY);
    if (sameFrame(frame, gesture.frame)) return;
    gesture.frame = frame;
    applyFrameRef.current(frame);
  }, []);

  /**
   * The one terminal path. `commit` false restores the frame the gesture started
   * from, so a cancelled gesture can never leave the panel at a half-dragged size.
   */
  const endGesture = useCallback(
    (commit: boolean, clientX?: number, clientY?: number) => {
      const gesture = gestureRef.current;
      if (gesture === null) return;
      gestureRef.current = null;

      if (moveFrameRef.current !== 0) {
        cancelAnimationFrame(moveFrameRef.current);
        moveFrameRef.current = 0;
      }
      pendingMoveRef.current = null;
      detachWindowListeners();

      if (gesture.captureEl.hasPointerCapture(gesture.pointerId)) {
        gesture.captureEl.releasePointerCapture(gesture.pointerId);
      }
      unlockPageInteraction();

      const final =
        commit && clientX !== undefined && clientY !== undefined
          ? computeFrame(gesture, clientX, clientY)
          : commit
            ? gesture.frame
            : gesture.committed;

      // Paint the committed frame before React can render it: the ghost and the
      // stored layout are the same numbers, so release never snaps.
      applyFrameRef.current(final);

      activeCornerRef.current = null;
      setActiveCorner(null);
      setIsResizing(false);

      if (!sameFrame(final, gesture.committed)) {
        commitRef.current(gesture.id, final.x, final.y, final.w, final.h);
      }
    },
    [detachWindowListeners],
  );

  const attachWindowListeners = useCallback(() => {
    if (handlersRef.current !== null) return;

    const handlers: WindowHandlers = {
      move: (e) => {
        const gesture = gestureRef.current;
        if (gesture === null || e.pointerId !== gesture.pointerId) return;
        if (e.cancelable) e.preventDefault();
        pendingMoveRef.current = { clientX: e.clientX, clientY: e.clientY };
        if (moveFrameRef.current !== 0) return;
        moveFrameRef.current = requestAnimationFrame(flushMove);
      },
      up: (e) => {
        const gesture = gestureRef.current;
        if (gesture === null || e.pointerId !== gesture.pointerId) return;
        endGesture(true, e.clientX, e.clientY);
      },
      cancel: (e) => {
        const gesture = gestureRef.current;
        if (gesture === null || e.pointerId !== gesture.pointerId) return;
        endGesture(false);
      },
      lostCapture: (e) => {
        const gesture = gestureRef.current;
        if (gesture === null || e.pointerId !== gesture.pointerId) return;
        endGesture(true);
      },
      key: (e) => {
        if (e.key !== "Escape" || gestureRef.current === null) return;
        e.preventDefault();
        endGesture(false);
      },
      blur: () => {
        endGesture(true);
      },
      contextMenu: (e) => {
        if (gestureRef.current === null) return;
        e.preventDefault();
        endGesture(false);
      },
    };

    handlersRef.current = handlers;
    // Capture phase: a handler inside the panel tree that stops propagation can
    // never strand the gesture without a terminal event.
    window.addEventListener("pointermove", handlers.move, { passive: false, capture: true });
    window.addEventListener("pointerup", handlers.up, true);
    window.addEventListener("pointercancel", handlers.cancel, true);
    window.addEventListener("lostpointercapture", handlers.lostCapture, true);
    window.addEventListener("keydown", handlers.key, true);
    window.addEventListener("blur", handlers.blur);
    window.addEventListener("contextmenu", handlers.contextMenu, true);
  }, [endGesture, flushMove]);

  const handlePointerDown = useCallback(
    (axis: ResizeHandleAxis) => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (gestureRef.current !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const handleEl = e.currentTarget;
      const gridEl =
        handleEl.closest<HTMLElement>('[style*="--grid-row-height"]') ??
        handleEl.parentElement?.parentElement ??
        null;
      if (gridEl === null) return;

      const measured = gridEl.getBoundingClientRect().width;
      const width = measured > 0 ? measured : containerWidth;
      if (width <= 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Capture on the handler element itself, never on e.target: the target can
      // be a nested SVG that disappears and takes the capture with it.
      handleEl.setPointerCapture(e.pointerId);

      const committed: ResizeFrame = { x: item.x, y: item.y, w: item.w, h: item.h };

      gestureRef.current = {
        id,
        axis,
        pointerId: e.pointerId,
        captureEl: handleEl,
        startX: e.clientX,
        startY: e.clientY,
        containerWidth: width,
        rowPitch: Math.max(1, readRowPitchPx(gridEl)),
        committed,
        limits: {
          minW,
          minH,
          minX,
          maxX: committed.x + maxW,
          minY,
          maxY: committed.y + maxH,
        },
        frame: committed,
      };

      activeCornerRef.current = axis;
      setActiveCorner(axis);
      setIsResizing(true);
      lockPageInteraction(axis);
      attachWindowListeners();
    },
    [
      id,
      item.x,
      item.y,
      item.w,
      item.h,
      minW,
      minH,
      maxW,
      maxH,
      minX,
      minY,
      containerWidth,
      attachWindowListeners,
    ],
  );

  const applyHover = useCallback(() => {
    hoverFrameRef.current = 0;
    const pending = pendingHoverRef.current;
    pendingHoverRef.current = null;
    if (pending === null || gestureRef.current !== null) return;

    const rect = pending.el.getBoundingClientRect();
    const { clientLeft, clientTop, clientWidth, clientHeight } = pending.el;
    // Absolute handles are placed against the padding box, so the hover box is measured
    // there too; the border must not offset the visible bracket from the hit test.
    const mx = pending.clientX - rect.left - clientLeft;
    const my = pending.clientY - rect.top - clientTop;
    const rw = clientWidth;
    const rh = clientHeight;

    // Clamped to the panel half-extent so two boxes can never meet across the middle
    // of a small panel and swallow the edge strips.
    const box = Math.min(CORNER_HIT_BOX_PX, rw / 2, rh / 2);

    const corners: { axis: ResizeHandleAxis; bx: number; by: number }[] = [
      { axis: "nw", bx: 0, by: 0 },
      { axis: "ne", bx: rw - box, by: 0 },
      { axis: "sw", bx: 0, by: rh - box },
      { axis: "se", bx: rw - box, by: rh - box },
    ];

    let closest: ResizeHandleAxis | null = null;
    let minDist = Number.POSITIVE_INFINITY;

    for (const { axis, bx, by } of corners) {
      const dist = distanceToBox(mx, my, bx, by, box);
      if (dist < minDist) {
        minDist = dist;
        closest = axis;
      }
    }

    // Outside every grab box nothing is shown: the visible bracket is the hit area.
    if (minDist > 0) closest = null;

    if (closest === activeCornerRef.current) return;
    activeCornerRef.current = closest;
    setActiveCorner(closest);
  }, []);

  const handlePanelMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (gestureRef.current !== null || isDragged) return;
      if (!(e.currentTarget instanceof Element)) return;

      pendingHoverRef.current = {
        el: e.currentTarget,
        clientX: e.clientX,
        clientY: e.clientY,
      };
      if (hoverFrameRef.current !== 0) return;
      hoverFrameRef.current = requestAnimationFrame(applyHover);
    },
    [isDragged, applyHover],
  );

  const handlePanelMouseLeave = useCallback(() => {
    if (hoverFrameRef.current !== 0) {
      cancelAnimationFrame(hoverFrameRef.current);
      hoverFrameRef.current = 0;
    }
    pendingHoverRef.current = null;

    if (gestureRef.current !== null) return;
    if (activeCornerRef.current !== null) {
      activeCornerRef.current = null;
      setActiveCorner(null);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (moveFrameRef.current !== 0) cancelAnimationFrame(moveFrameRef.current);
      if (hoverFrameRef.current !== 0) cancelAnimationFrame(hoverFrameRef.current);
      moveFrameRef.current = 0;
      hoverFrameRef.current = 0;
      pendingMoveRef.current = null;
      pendingHoverRef.current = null;
      detachWindowListeners();
      // Only a gesture that actually locked the page may unlock it.
      if (gestureRef.current !== null) unlockPageInteraction();
      gestureRef.current = null;
    };
  }, [detachWindowListeners]);

  return {
    isResizing,
    activeCorner,
    handlePointerDown,
    handlePanelMouseMove,
    handlePanelMouseLeave,
  };
}
