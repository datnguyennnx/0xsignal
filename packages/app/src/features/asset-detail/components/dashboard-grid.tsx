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
} from "react";
import { createPortal } from "react-dom";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLayoutStore } from "@/stores/use-layout-store";
import { ResizableWrapper } from "./resizable-wrapper";
import { useLiftAndFloat } from "../hooks/use-lift-and-float";
import { GRID_ROW_HEIGHT, GRID_GUTTER } from "../utils/constants";
import { cellWidth, getResizeConstraints } from "../utils/collision";
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

  const maxBottom = layout.reduce((max, item) => {
    const bottom = (item.y + item.h) * (GRID_ROW_HEIGHT + GRID_GUTTER) - GRID_GUTTER;
    return Math.max(max, bottom);
  }, 0);
  const totalHeight = maxBottom + GRID_GUTTER;

  const cw = cellWidth(containerWidth);

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
        style={{ height: `${totalHeight}px` }}
      >
        {/* Panels */}
        {panels.map((panel) => {
          const item = layout.find((li) => li.i === panel.id);
          if (!item) return null;

          // Compute collision bounds against OTHER items (except self)
          const others = layout.filter((li) => li.i !== panel.id);
          const { maxW, maxH, minX, minY } = getResizeConstraints(item, others);

          return (
            <ErrorBoundary key={item.i}>
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
            className="absolute pointer-events-none z-40 rounded-xl border-2 border-dashed transition-none"
            style={{
              left: `${previewState.gridX * (cw + GRID_GUTTER)}px`,
              top: `${previewState.gridY * (GRID_ROW_HEIGHT + GRID_GUTTER)}px`,
              width: `${draggedLayoutItem.w * cw + (draggedLayoutItem.w - 1) * GRID_GUTTER}px`,
              height: `${draggedLayoutItem.h * GRID_ROW_HEIGHT + (draggedLayoutItem.h - 1) * GRID_GUTTER}px`,
              borderColor: previewState.isValid
                ? "hsl(var(--primary) / 0.5)"
                : "hsl(var(--destructive) / 0.7)",
              backgroundColor: previewState.isValid
                ? "hsl(var(--primary) / 0.06)"
                : "hsl(var(--destructive) / 0.08)",
            }}
          />
        )}

        {/* Glass shell — phantom overlay for repositioning */}
        {isDragging &&
          draggedItemId &&
          phantomSize &&
          createPortal(
            <ErrorBoundary>
              <div
                ref={phantomRef}
                className="fixed left-0 top-0 pointer-events-none"
                style={{
                  width: `${phantomSize.width}px`,
                  height: `${phantomSize.height}px`,
                  willChange: "transform",
                  zIndex: Z.glassShell,
                }}
                aria-hidden="true"
              >
                <div className="h-full w-full bg-neutral-900/50 backdrop-blur-sm border border-neutral-700 rounded-lg flex items-center justify-center">
                  <div className="text-center px-4">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <div className="size-2 rounded-full bg-neutral-500 animate-pulse" />
                      <p className="text-sm font-medium text-neutral-300">
                        {panelNamesMap[draggedItemId] ?? draggedItemId}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-500">Dragging to reorder</p>
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
