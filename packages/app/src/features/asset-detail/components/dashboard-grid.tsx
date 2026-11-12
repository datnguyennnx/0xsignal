import {
  useRef,
  useState,
  useLayoutEffect,
  Children,
  isValidElement,
  useCallback,
  useMemo,
  type CSSProperties,
} from "react";
import { cn } from "cn";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLayoutStore } from "@/stores/use-layout-store";
import { ResizableWrapper } from "./resizable-wrapper";
import { useLiftAndFloat } from "../hooks/use-lift-and-float";
import { cellWidth, GRID_GUTTER_FRACTION, getResizeBounds, minCells } from "../utils/collision";
import { DEFAULT_ROW_COUNT, GRID_ROW_HEIGHT_FIT_CSS, gridRowsHeightCss } from "../utils/constants";
import type { DashboardGridProps } from "../utils/types";

/** `--grid-row-height` is intentionally not part of CSSProperties; widen the type once. */
type GridCanvasStyle = CSSProperties & { "--grid-row-height": string };

export function DashboardGrid({ children, className = "" }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const layout = useLayoutStore((s) => s.items);

  const handleResizeCommit = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const newItems = layout.map((item) => (item.i === id ? { ...item, x, y, w, h } : item));
      useLayoutStore.getState().commitLayout(newItems, id, "resize");
    },
    [layout],
  );

  const handleRepositionCommit = useCallback(
    (id: string, x: number, y: number) => {
      const newItems = layout.map((item) => (item.i === id ? { ...item, x, y } : item));
      useLayoutStore.getState().commitLayout(newItems, id, "drag");
    },
    [layout],
  );

  const { draggedItemId, previewState, handleRepositionStart } = useLiftAndFloat({
    containerRef,
    containerWidth,
    layout,
    onRepositionCommit: handleRepositionCommit,
  });

  // The canvas lays its panels out in percentages, so no measurement feeds a frame.
  // The width below exists only for the drag/resize gestures (pixels → grid cells),
  // and the observer's first entry lands before paint.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el === null) return () => {};

    let committedWidth = 0;
    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      if (entry === undefined) return;
      const width = entry.contentRect.width;
      if (width === committedWidth) return;
      committedWidth = width;
      setContainerWidth(width);
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, []);

  const panels = useMemo(() => {
    const result: { id: string; element: React.ReactNode }[] = [];
    Children.forEach(children, (child) => {
      if (!isValidElement<{ id?: string; children?: React.ReactNode }>(child)) return;
      const { id, children: element } = child.props;
      if (id !== undefined) result.push({ id, element });
    });
    return result;
  }, [children]);

  const draggedLayoutItem = useMemo(
    () => (draggedItemId === null ? null : (layout.find((li) => li.i === draggedItemId) ?? null)),
    [draggedItemId, layout],
  );

  const maxRow = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

  // Default fit, not a cap: every row is one fit pitch tall, so DEFAULT_ROW_COUNT rows
  // land exactly on the region on the first paint, while a taller user layout extends the
  // canvas past it and the page scrolls — no panel is clipped to the viewport.
  const rowCount = Math.max(maxRow, 1);
  const canvasStyle: GridCanvasStyle = {
    "--grid-row-height": GRID_ROW_HEIGHT_FIT_CSS,
    height: gridRowsHeightCss(rowCount),
    minHeight: gridRowsHeightCss(DEFAULT_ROW_COUNT),
  };

  const cw = cellWidth();
  const cellStep = cw + GRID_GUTTER_FRACTION;

  return (
    <div
      ref={containerRef}
      className={`container-query relative w-full ${className}`}
      style={canvasStyle}
    >
      {/* Panels */}
      {panels.map((panel) => {
        const item = layout.find((li) => li.i === panel.id);
        if (!item) return null;

        // Resize bounds against the other panels: the corridor this panel may fill.
        const others = layout.filter((li) => li.i !== panel.id);
        const bounds = getResizeBounds(item, others);
        const { minW, minH } = minCells(item);

        return (
          <ErrorBoundary key={item.i} resetKey={item.i}>
            <ResizableWrapper
              id={item.i}
              item={item}
              containerWidth={containerWidth}
              minW={minW}
              minH={minH}
              maxW={bounds.maxX - item.x}
              maxH={bounds.maxY - item.y}
              minX={bounds.minX}
              minY={bounds.minY}
              onResizeCommit={handleResizeCommit}
              onRepositionStart={handleRepositionStart}
              isDragged={draggedItemId === item.i}
            >
              {panel.element}
            </ResizableWrapper>
          </ErrorBoundary>
        );
      })}

      {/* Drop preview — grid-snapped dashed outline */}
      {previewState && draggedLayoutItem && (
        <div
          className={cn(
            "absolute pointer-events-none z-40 rounded-panel border-2 border-dashed transition-none",
            previewState.isValid
              ? "border-primary/40 bg-primary/5"
              : "border-destructive/60 bg-destructive/10",
          )}
          style={{
            left: `${previewState.gridX * cellStep * 100}%`,
            top: `calc(${previewState.gridY} * var(--grid-row-height) + ${previewState.gridY} * 0.5rem)`,
            width: `${(draggedLayoutItem.w * cw + (draggedLayoutItem.w - 1) * GRID_GUTTER_FRACTION) * 100}%`,
            height: `calc(${draggedLayoutItem.h} * var(--grid-row-height) + ${draggedLayoutItem.h - 1} * 0.5rem)`,
          }}
        />
      )}
    </div>
  );
}

DashboardGrid.displayName = "DashboardGrid";
