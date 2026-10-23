import { useRef, useState, useEffect, useCallback } from "react";
import type { LayoutItem } from "../utils/types";
import { GRID_COLS } from "../utils/constants";
import { cellWidth, GRID_GUTTER_FRACTION, snapToGridUnits } from "../utils/collision";
import { readRowPitchPx } from "../utils/row-pitch";

interface UseLiftAndFloatOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  containerWidth: number;
  layout: LayoutItem[];
  onRepositionCommit: (id: string, x: number, y: number) => void;
}

interface DragState {
  draggedItemId: string;
  startClientX: number;
  startClientY: number;
  startItemX: number;
  startItemY: number;
  itemW: number;
  itemH: number;
  containerHeight: number;
  rowStep: number;
  phantomXFrac: number;
  phantomYFrac: number;
}

interface PreviewState {
  gridX: number;
  gridY: number;
  isValid: boolean;
}

export interface UseLiftAndFloatReturn {
  isDragging: boolean;
  draggedItemId: string | null;
  previewState: PreviewState | null;
  phantomRef: React.RefObject<HTMLDivElement | null>;
  phantomSize: { width: number; height: number } | null;
  handleRepositionStart: (id: string, e: React.PointerEvent) => void;
}

/** Position the viewport-fixed phantom from container-relative fractions. */
function phantomTranslate(
  rect: DOMRect,
  xFrac: number,
  yFrac: number,
  dx: number,
  dy: number,
): string {
  const x = rect.left + xFrac * rect.width + dx;
  const y = rect.top + yFrac * rect.height + dy;
  return `translate(${x}px, ${y}px)`;
}

function computeProjectedPosition(
  dragState: DragState,
  pixelDx: number,
  pixelDy: number,
  containerWidth: number,
  allItems: LayoutItem[],
): PreviewState {
  const snappedDx = snapToGridUnits(pixelDx / containerWidth, cellWidth());
  const rowStep = dragState.rowStep;
  const snappedDy = Math.round(pixelDy / dragState.containerHeight / rowStep);

  const proposedX = Math.max(
    0,
    Math.min(GRID_COLS - dragState.itemW, dragState.startItemX + snappedDx),
  );
  const proposedY = Math.max(0, dragState.startItemY + snappedDy);

  // Check collision: overlap with any item EXCEPT the dragged one
  const collision = allItems.some(
    (other) =>
      other.i !== dragState.draggedItemId &&
      proposedX < other.x + other.w &&
      proposedX + dragState.itemW > other.x &&
      proposedY < other.y + other.h &&
      proposedY + dragState.itemH > other.y,
  );

  return { gridX: proposedX, gridY: proposedY, isValid: !collision };
}

export function useLiftAndFloat({
  containerRef,
  containerWidth,
  layout,
  onRepositionCommit,
}: UseLiftAndFloatOptions): UseLiftAndFloatReturn {
  const dragStateRef = useRef<DragState | null>(null);
  const previewStateRef = useRef<PreviewState | null>(null);
  const pointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const phantomRef = useRef<HTMLDivElement | null>(null);
  const containerElRef = useRef<HTMLDivElement | null>(null);
  const latestDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const rafIdRef = useRef(0);
  const handleMoveRef = useRef<((e: PointerEvent) => void) | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [phantomSize, setPhantomSize] = useState<{ width: number; height: number } | null>(null);

  const layoutRef = useRef(layout);
  const containerWidthRef = useRef(containerWidth);
  const onRepositionCommitRef = useRef(onRepositionCommit);

  // Sync refs after render (never during render)
  useEffect(() => {
    layoutRef.current = layout;
    containerWidthRef.current = containerWidth;
    onRepositionCommitRef.current = onRepositionCommit;
    containerElRef.current = containerRef.current;
  });

  // Both handlers use only refs — never stale closures.
  // They have stable identity via useCallback([]).

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds) return;

    const dx = e.clientX - ds.startClientX;
    const dy = e.clientY - ds.startClientY;

    // Track latest delta for rAF-throttled phantom DOM update
    latestDeltaRef.current = { dx, dy };

    // Schedule rAF for phantom DOM update (throttled to vsync)
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = 0;
        const { dx: latestDx, dy: latestDy } = latestDeltaRef.current;
        const phantom = phantomRef.current;
        const rect = containerElRef.current?.getBoundingClientRect();
        if (phantom && rect) {
          phantom.style.transform = phantomTranslate(
            rect,
            ds.phantomXFrac,
            ds.phantomYFrac,
            latestDx,
            latestDy,
          );
        }
      });
    }

    const projected = computeProjectedPosition(
      ds,
      dx,
      dy,
      containerWidthRef.current,
      layoutRef.current,
    );

    // Only update if grid position or validity changed; comparing against the ref
    // avoids queueing a React update at all for sub-cell movement.
    const previous = previewStateRef.current;
    if (
      previous?.gridX === projected.gridX &&
      previous?.gridY === projected.gridY &&
      previous?.isValid === projected.isValid
    )
      return;

    previewStateRef.current = projected;
    setPreviewState(projected);
  }, []);

  const handlePointerUp = useCallback((_e: PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds) return;

    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }

    const lastPreview = previewStateRef.current;
    const commitX = lastPreview?.gridX ?? ds.startItemX;
    const commitY = lastPreview?.gridY ?? ds.startItemY;

    dragStateRef.current = null;
    previewStateRef.current = null;
    setIsDragging(false);
    setDraggedItemId(null);
    setPreviewState(null);
    setPhantomSize(null);

    const currentItem = layoutRef.current.find((li) => li.i === ds.draggedItemId);
    if (currentItem && (commitX !== currentItem.x || commitY !== currentItem.y)) {
      onRepositionCommitRef.current(ds.draggedItemId, commitX, commitY);
    }

    // Clean up document listeners via refs (stable identity, no cycle)
    const moveHandler = handleMoveRef.current;
    if (moveHandler) {
      document.removeEventListener("pointermove", moveHandler);
    }
    const upHandler = pointerUpRef.current;
    if (upHandler) {
      document.removeEventListener("pointerup", upHandler);
      document.removeEventListener("pointercancel", upHandler);
    }
  }, []);

  useEffect(() => {
    handleMoveRef.current = handlePointerMove;
  }, [handlePointerMove]);
  useEffect(() => {
    pointerUpRef.current = handlePointerUp;
  }, [handlePointerUp]);

  const handleRepositionStart = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (dragStateRef.current) return;

      if (!(e.target instanceof Element)) return;
      const target = e.target;
      target.setPointerCapture(e.pointerId);

      const currentLayout = layoutRef.current;
      const item = currentLayout.find((li) => li.i === id);
      const container = containerRef.current;
      if (!item || !container) return;

      // Calculate phantom position in viewport coords
      const containerRect = container.getBoundingClientRect();
      const cellStep = cellWidth() + GRID_GUTTER_FRACTION;
      const rowStep = readRowPitchPx(container) / containerRect.height;
      const phantomXFrac = item.x * cellStep;
      const phantomYFrac = item.y * rowStep;

      // Get original item's DOM element to measure dimensions
      const originalElement = container.querySelector<HTMLElement>(`[data-panel-id="${id}"]`);
      if (originalElement) {
        const rect = originalElement.getBoundingClientRect();
        setPhantomSize({ width: rect.width, height: rect.height });
      }

      dragStateRef.current = {
        draggedItemId: id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startItemX: item.x,
        startItemY: item.y,
        itemW: item.w,
        itemH: item.h,
        containerHeight: containerRect.height,
        rowStep,
        phantomXFrac,
        phantomYFrac,
      };

      if (phantomRef.current) {
        phantomRef.current.style.transform = phantomTranslate(
          containerRect,
          phantomXFrac,
          phantomYFrac,
          0,
          0,
        );
      }

      setIsDragging(true);
      setDraggedItemId(id);

      // Attach document-level listeners via refs (stable identity)
      const moveHandler = handleMoveRef.current;
      const upHandler = pointerUpRef.current;
      if (moveHandler) document.addEventListener("pointermove", moveHandler);
      if (upHandler) {
        document.addEventListener("pointerup", upHandler);
        document.addEventListener("pointercancel", upHandler);
      }
    },
    [containerRef],
  );

  useEffect(() => {
    if (!isDragging) return;
    const ds = dragStateRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (phantomRef.current && ds && rect) {
      phantomRef.current.style.transform = phantomTranslate(
        rect,
        ds.phantomXFrac,
        ds.phantomYFrac,
        0,
        0,
      );
    }
  }, [isDragging, containerRef]);

  return {
    isDragging,
    draggedItemId,
    previewState,
    phantomRef,
    phantomSize,
    handleRepositionStart,
  };
}
