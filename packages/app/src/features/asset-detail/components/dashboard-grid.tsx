import {
  useRef,
  useState,
  useEffect,
  Children,
  isValidElement,
  useCallback,
  useMemo,
  createContext,
  useContext,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "cn";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLayoutStore } from "@/stores/use-layout-store";
import { ResizableWrapper } from "./resizable-wrapper";
import { useLiftAndFloat } from "../hooks/use-lift-and-float";
import { GRID_ROW_HEIGHT_CSS } from "../utils/constants";
import { cellWidth, GRID_GUTTER_FRACTION, getResizeConstraints } from "../utils/collision";
import type { DashboardGridProps } from "../utils/types";

const Z = {
  dropPreview: 40,
  glassShell: 50,
} as const;

// Context to detect if DashboardPanel is rendered inside DashboardGrid
const DashboardGridContext = createContext(false);

interface DashboardPanelProps {
  id: string;
  children: React.ReactNode;
}

export function DashboardPanel({ children }: DashboardPanelProps) {
  // Check if rendered inside DashboardGrid
  // This component is a data-descriptor — its children are extracted and rendered
  // by DashboardGrid. It should never be mounted as a standalone component.
  if (!useContext(DashboardGridContext)) {
    throw new Error(
      "DashboardPanel is a data-descriptor that must be a direct child of DashboardGrid. " +
        'It cannot be rendered standalone. Use <DashboardGrid><DashboardPanel id="...">...</DashboardPanel></DashboardGrid>.',
    );
  }
  return <>{children}</>;
}

export function DashboardGrid({ children, className = "", panelNames }: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800); // fallback

  const layout = useLayoutStore((s) => s.items);

  const handleResizeCommit = useCallback(
    (id: string, x: number, y: number, w: number, h: number) => {
      const originalItem = layout.find((item) => item.i === id);
      const newItems = layout.map((item) => (item.i === id ? { ...item, x, y, w, h } : item));
      useLayoutStore.getState().commitLayout(newItems, id, "resize", originalItem);
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const panels = useMemo(() => {
    const result: { id: string; element: React.ReactNode }[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && child.type === DashboardPanel) {
        const id = (child.props as { id: string }).id;
        result.push({ id, element: (child.props as { children: React.ReactNode }).children });
      } else if (isValidElement(child) && (child.props as { id?: string })?.id) {
        // Allow direct div with id prop
        const id = (child.props as { id: string }).id;
        result.push({ id, element: child });
      }
    });
    return result;
  }, [children]);

  const draggedLayoutItem = useMemo(
    () => (draggedItemId ? layout.find((li) => li.i === draggedItemId) : null),
    [draggedItemId, layout],
  );

  const maxRow = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

  const cw = cellWidth();
  const cellStep = cw + GRID_GUTTER_FRACTION;

  const DEFAULT_PANEL_NAMES: Record<string, string> = {
    chart: "Chart",
    orderbook: "Order Book",
    orderform: "Order Form",
    positions: "Positions",
  };

  const panelNamesMap = { ...DEFAULT_PANEL_NAMES, ...panelNames };

  return (
    <DashboardGridContext value={true}>
      <div
        ref={containerRef}
        className={`relative w-full ${className}`}
        style={
          {
            height: `calc(${maxRow} * var(--grid-row-height) + ${maxRow - 1} * 0.5rem)`,
            "--grid-row-height": GRID_ROW_HEIGHT_CSS,
          } as CSSProperties
        }
      >
        {/* Panels */}
        {panels.map((panel) => {
          const item = layout.find((li) => li.i === panel.id);
          if (!item) return null;

          // Compute collision bounds against OTHER items (except self)
          const others = layout.filter((li) => li.i !== panel.id);
          const { maxW, maxH, minX, minY } = getResizeConstraints(item, others);

          return (
            <ErrorBoundary key={item.i} resetKey={item.i}>
              <ResizableWrapper
                id={item.i}
                item={item}
                containerWidth={containerWidth}
                maxW={maxW}
                maxH={maxH}
                minX={minX}
                minY={minY}
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
              "absolute pointer-events-none z-40 rounded-xl border-2 border-dashed transition-none",
              previewState.isValid
                ? "border-primary/40 bg-primary/[0.06]"
                : "border-destructive/60 bg-destructive/[0.08]",
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
          draggedItemId &&
          phantomSize &&
          draggedLayoutItem &&
          createPortal(
            <ErrorBoundary resetKey={draggedItemId}>
              <div
                ref={phantomRef}
                className="fixed left-0 top-0 pointer-events-none will-change-transform"
                style={{
                  width: `${(draggedLayoutItem.w * cw + (draggedLayoutItem.w - 1) * GRID_GUTTER_FRACTION) * 100}%`,
                  height: `calc(${draggedLayoutItem.h} * var(--grid-row-height) + ${draggedLayoutItem.h - 1} * 0.5rem)`,
                  zIndex: Z.glassShell,
                }}
                aria-hidden="true"
              >
                <div className="h-full w-full bg-card backdrop-blur-sm border border-border rounded-lg flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="size-2 rounded-full bg-muted-foreground animate-pulse" />
                      <p className="text-sm font-medium text-foreground">
                        {panelNamesMap[draggedItemId] ?? draggedItemId}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">Dragging to reorder</p>
                  </div>
                </div>
              </div>
            </ErrorBoundary>,
            document.body,
          )}
      </div>
    </DashboardGridContext>
  );
}

DashboardGrid.displayName = "DashboardGrid";
DashboardPanel.displayName = "DashboardPanel";
