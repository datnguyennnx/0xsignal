import { useRef, useState, useEffect, useCallback } from "react";
import type { LayoutItem } from "../utils/types";
import { GRID_COLS, GRID_ROW_HEIGHT, GRID_GUTTER } from "../utils/constants";
import { cellWidth } from "../utils/collision";

// Interfaces

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
  initialPhantomX: number;
  initialPhantomY: number;
}

export interface PreviewState {
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

// Collision-Aware Projection

function computeProjectedPosition(
  dragState: DragState,
  pixelDx: number,
  pixelDy: number,
  containerWidth: number,
  allItems: LayoutItem[]
): PreviewState {
  const cw = cellWidth(containerWidth);
  const unitW = cw + GRID_GUTTER;
  const unitH = GRID_ROW_HEIGHT + GRID_GUTTER;

  const snappedDx = Math.round(pixelDx / unitW);
  const snappedDy = Math.round(pixelDy / unitH);

  const proposedX = Math.max(
    0,
    Math.min(GRID_COLS - dragState.itemW, dragState.startItemX + snappedDx)
  );
  const proposedY = Math.max(0, dragState.startItemY + snappedDy);

  // Check collision: overlap with any item EXCEPT the dragged one
  const collision = allItems.some(
    (other) =>
      other.i !== dragState.draggedItemId &&
      proposedX < other.x + other.w &&
      proposedX + dragState.itemW > other.x &&
      proposedY < other.y + other.h &&
      proposedY + dragState.itemH > other.y
  );

  return { gridX: proposedX, gridY: proposedY, isValid: !collision };
}

// Hook

export function useLiftAndFloat({
  containerRef,
  containerWidth,
  layout,
  onRepositionCommit,
}: UseLiftAndFloatOptions): UseLiftAndFloatReturn {
  // Refs (no re-renders)
  const dragStateRef = useRef<DragState | null>(null);
  const previewStateRef = useRef<PreviewState | null>(null);
  const pointerUpRef = useRef<((e: PointerEvent) => void) | null>(null);
  const phantomRef = useRef<HTMLDivElement | null>(null);
  const latestDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const rafIdRef = useRef(0);
  const handleMoveRef = useRef<((e: PointerEvent) => void) | null>(null);

  // React visual state
  const [isDragging, setIsDragging] = useState(false);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [phantomSize, setPhantomSize] = useState<{ width: number; height: number } | null>(null);

  // Ref synchronization
  const layoutRef = useRef(layout);
  const containerWidthRef = useRef(containerWidth);
  const onRepositionCommitRef = useRef(onRepositionCommit);

  // Sync refs after render (never during render)
  useEffect(() => {
    layoutRef.current = layout;
    containerWidthRef.current = containerWidth;
    onRepositionCommitRef.current = onRepositionCommit;
  });

  // Event Handlers
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
        if (phantom) {
          phantom.style.transform = `translate(${ds.initialPhantomX + latestDx}px, ${ds.initialPhantomY + latestDy}px)`;
        }
      });
    }

    const projected = computeProjectedPosition(
      ds,
      dx,
      dy,
      containerWidthRef.current,
      layoutRef.current
    );

    // Only update if grid position or validity changed
    setPreviewState((prev) =>
      prev?.gridX === projected.gridX &&
      prev?.gridY === projected.gridY &&
      prev?.isValid === projected.isValid
        ? prev
        : projected
    );
    previewStateRef.current = projected;
  }, []);

  const handlePointerUp = useCallback((_e: PointerEvent) => {
    const ds = dragStateRef.current;
    if (!ds) return;

    // Cancel any pending rAF
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = 0;
    }

    const lastPreview = previewStateRef.current;
    const commitX = lastPreview?.gridX ?? ds.startItemX;
    const commitY = lastPreview?.gridY ?? ds.startItemY;

    // Clear ALL visual state
    dragStateRef.current = null;
    previewStateRef.current = null;
    setIsDragging(false);
    setDraggedItemId(null);
    setPreviewState(null);
    setPhantomSize(null);

    // Commit if position changed
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

  // Sync refs after mount so cleanup can reference themselves without TDZ
  useEffect(() => {
    handleMoveRef.current = handlePointerMove;
  }, [handlePointerMove]);
  useEffect(() => {
    pointerUpRef.current = handlePointerUp;
  }, [handlePointerUp]);

  // handleRepositionStart
  const handleRepositionStart = useCallback(
    (id: string, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Prevent concurrent drags
      if (dragStateRef.current) return;

      const target = e.target as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const currentLayout = layoutRef.current;
      const item = currentLayout.find((li) => li.i === id);
      const container = containerRef.current;
      if (!item || !container) return;

      // Calculate phantom position in viewport coords
      const containerRect = container.getBoundingClientRect();
      const cw = cellWidth(containerWidthRef.current);
      const initialPhantomX = containerRect.left + item.x * (cw + GRID_GUTTER);
      const initialPhantomY = containerRect.top + item.y * (GRID_ROW_HEIGHT + GRID_GUTTER);

      // Get original item's DOM element to measure dimensions
      const originalElement = container.querySelector(
        `[data-panel-id="${id}"]`
      ) as HTMLElement | null;
      if (originalElement) {
        const rect = originalElement.getBoundingClientRect();
        setPhantomSize({ width: rect.width, height: rect.height });
      }

      // Store gesture state
      dragStateRef.current = {
        draggedItemId: id,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startItemX: item.x,
        startItemY: item.y,
        itemW: item.w,
        itemH: item.h,
        initialPhantomX,
        initialPhantomY,
      };

      // Set initial phantom position immediately
      if (phantomRef.current) {
        phantomRef.current.style.transform = `translate(${initialPhantomX}px, ${initialPhantomY}px)`;
      }

      // Trigger React re-render to show preview
      setIsDragging(true);
      setDraggedItemId(id);

      // Attach document-level listeners via refs (stable identity)
      document.addEventListener("pointermove", handleMoveRef.current!);
      document.addEventListener("pointerup", pointerUpRef.current!);
      document.addEventListener("pointercancel", pointerUpRef.current!);
    },
    [containerRef]
  );

  // Sync phantom position
  useEffect(() => {
    if (!isDragging) return;
    const ds = dragStateRef.current;
    if (phantomRef.current && ds) {
      phantomRef.current.style.transform = `translate(${ds.initialPhantomX}px, ${ds.initialPhantomY}px)`;
    }
  }, [isDragging]);

  return {
    isDragging,
    draggedItemId,
    previewState,
    phantomRef,
    phantomSize,
    handleRepositionStart,
  };
}
