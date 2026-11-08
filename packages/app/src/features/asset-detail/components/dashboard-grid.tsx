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
import { createPortal } from "react-dom";
import { cn } from "cn";
import { ErrorBoundary } from "@/components/error-boundary";
import { Surface } from "@/components/surface/surface";
import { useLayoutStore } from "@/stores/use-layout-store";
import { ResizableWrapper } from "./resizable-wrapper";
import { useLiftAndFloat } from "../hooks/use-lift-and-float";
import { cellWidth, GRID_GUTTER_FRACTION, getResizeBounds, minCells } from "../utils/collision";
import {
  DEFAULT_ROW_COUNT,
  GRID_ROW_HEIGHT_FIT_CSS,
  gridRowsHeightCss,
  PANELS,
} from "../utils/constants";
import type { DashboardGridProps } from "../utils/types";

const PANEL_LABELS: Record<string, string> = Object.fromEntries(
  PANELS.map((panel) => [panel.id, panel.label]),
);

/** `--grid-row-height` is intentionally not part of CSSProperties; widen the type once. */
type GridCanvasStyle = CSSProperties & { "--grid-row-height": string };

const Z = {
  dropPreview: 40,
  glassShell: 50,
} as const;

export function DashboardGrid({ children, className = "", panelNames }: DashboardGridProps) {
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

  const {
    isDragging,
    draggedItemId,
    previewState,
    phantomRef,
    phantomSize,
    handleRepositionStart,
  } = useLiftAndFloat({
    containerRef,
    containerWidth,
    layout,
    onRepositionCommit: handleRepositionCommit,
  });

  // Measure before the first paint (a post-paint effect would let a frame render on a
  // provisional width) and keep tracking later container resizes. Observer bursts are
  // coalesced into one rAF commit, and a width equal to the last committed one is dropped.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (el === null) return () => {};

    let frame = 0;
    let pendingWidth = 0;
    let committedWidth = el.getBoundingClientRect().width;
    setContainerWidth(committedWidth);

    const flush = () => {
      frame = 0;
      if (pendingWidth === committedWidth) return;
      committedWidth = pendingWidth;
      setContainerWidth(pendingWidth);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(-1);
      if (entry === undefined) return;
      pendingWidth = entry.contentRect.width;
      if (pendingWidth === committedWidth || frame !== 0) return;
      frame = requestAnimationFrame(flush);
    });
    observer.observe(el);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
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

  const panelNamesMap = { ...PANEL_LABELS, ...panelNames };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`} style={canvasStyle}>
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

      {/* Glass shell — phantom overlay for repositioning */}
      {isDragging &&
        draggedItemId !== null &&
        phantomSize !== null &&
        draggedLayoutItem !== null &&
        createPortal(
          <ErrorBoundary resetKey={draggedItemId}>
            <div
              ref={phantomRef}
              className="fixed left-0 top-0 pointer-events-none"
              style={{
                width: `${(draggedLayoutItem.w * cw + (draggedLayoutItem.w - 1) * GRID_GUTTER_FRACTION) * 100}%`,
                height: `calc(${draggedLayoutItem.h} * var(--grid-row-height) + ${draggedLayoutItem.h - 1} * 0.5rem)`,
                zIndex: Z.glassShell,
              }}
              aria-hidden="true"
            >
              <Surface
                tier="floating"
                radius="control"
                className="h-full w-full flex items-center justify-center"
              >
                <div className="text-center px-4">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <div className="size-2 rounded-full bg-muted-foreground animate-pulse" />
                    <p className="type-control font-medium text-foreground">
                      {panelNamesMap[draggedItemId] ?? draggedItemId}
                    </p>
                  </div>
                  <p className="type-label text-muted-foreground">Dragging to reorder</p>
                </div>
              </Surface>
            </div>
          </ErrorBoundary>,
          document.body,
        )}
    </div>
  );
}

DashboardGrid.displayName = "DashboardGrid";
