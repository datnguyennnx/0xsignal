import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/surface/surface";
import { cn } from "cn";
import { MarketHeader, MarketRowSkeleton } from "./trade-dropdown.columns";
import { MarketRow } from "./market-row";
import { getColumns } from "../utils/trade-dropdown-columns";
import { TAB_ORDER, TAB_TO_CATEGORY } from "../utils/trade-dropdown";
import { computeWindow } from "../lib/market-window";
import { prewarmMarketCells } from "../lib/format-trade-rows";
import type { CategoryTab } from "../utils/trade-dropdown";
import type { MarketRowData } from "../lib/market-row-data";

const SKELETON_ROW_IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

/**
 * A row is 2.0125rem: `type-body` (0.875rem * 1.5) plus `py-1` (0.35rem each
 * side). The app root is clamped to ~14.4px, so the fallback is ~29px; the
 * ResizeObserver measures a real row and replaces it when the root shifts.
 */
const ROW_HEIGHT = 29;
const OVERSCAN = 8;
const PREWARM_ROWS = 40;

/** Schedules `callback` off the critical path; the returned cancel owns the handle. */
function scheduleIdle(callback: () => void): () => void {
  if (typeof requestIdleCallback === "function") {
    const idleHandle = requestIdleCallback(callback, { timeout: 500 });
    return () => {
      cancelIdleCallback(idleHandle);
    };
  }
  const timerHandle = setTimeout(callback, 120);
  return () => {
    clearTimeout(timerHandle);
  };
}

interface TradeDropdownPanelProps {
  id: string;
  position: { top: number; left: number };
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryTab;
  onCategoryChange: (category: CategoryTab) => void;
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
  rows: MarketRowData[];
  currentSymbol: string;
  dataVersion: number;
  isLoading: boolean;
  hasError: boolean;
  onSelect: (asset: { rawCoin: string }) => void;
}

export function TradeDropdownPanel({
  id,
  position,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sortBy,
  sortDesc,
  onSort,
  rows,
  currentSymbol,
  dataVersion,
  isLoading,
  hasError,
  onSelect,
}: TradeDropdownPanelProps) {
  const columns = getColumns(category);
  const activeCoin = currentSymbol.toLowerCase();
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstRowRef = useRef<HTMLButtonElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT);

  // A passive scroll listener coalesces to one state update per animation frame.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return () => {};

    let frame: number | null = null;
    let pendingTop = element.scrollTop;

    const handleScroll = () => {
      pendingTop = element.scrollTop;
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        setScrollTop(pendingTop);
      });
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", handleScroll);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  // Measure the viewport and a real row; never measure inside onScroll.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || rows.length === 0) return () => {};

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === element) {
          setViewportHeight(element.clientHeight);
          continue;
        }
        if (!(entry.target instanceof HTMLElement)) continue;
        const measured = entry.target.offsetHeight;
        if (measured > 0) setRowHeight(measured);
      }
    });

    observer.observe(element);
    if (firstRowRef.current) observer.observe(firstRowRef.current);
    return () => {
      observer.disconnect();
    };
  }, [rows]);

  // The highlighted market must be visible even when it falls outside the window.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const index = rows.findIndex((row) => row.rawCoin.toLowerCase() === activeCoin);
    if (index < 0) return;
    const top = index * rowHeight;
    if (top < element.scrollTop || top + rowHeight > element.scrollTop + element.clientHeight) {
      element.scrollTop = Math.max(0, top - rowHeight * 2);
    }
  }, [rows, activeCoin, rowHeight]);

  // Warm the next screen while idle; the scheduler cancels when the panel closes.
  useEffect(() => {
    if (rows.length === 0) return () => {};
    return scheduleIdle(() => {
      prewarmMarketCells(rows, dataVersion, PREWARM_ROWS);
    });
  }, [rows, dataVersion]);

  // A tab or query swap replaces the list, so keep the new list anchored at the
  // top instead of stranding the user at the old offset (possibly past the end).
  const resetScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = 0;
  }, []);

  const handleClearQuery = useCallback(() => {
    resetScroll();
    onQueryChange("");
  }, [onQueryChange, resetScroll]);

  const { start, end, topSpacer, bottomSpacer } = computeWindow({
    scrollTop,
    viewportHeight,
    rowHeight,
    total: rows.length,
    overscan: OVERSCAN,
  });
  const windowRows = rows.slice(start, end);

  return (
    <Surface
      id={id}
      tier="floating"
      radius="overlay"
      material="glass"
      thickness="regular"
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a portalled popover surface, not a native modal
      role="dialog"
      aria-label="Select market"
      className="fixed z-50 w-[calc(100vw-16px)] sm:w-[90vw] max-w-[56rem] text-popover-foreground"
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-icon text-muted-foreground" />
          <label htmlFor="trade-dropdown-search" className="sr-only">
            Search markets
          </label>
          <Input
            id="trade-dropdown-search"
            autoFocus
            value={query}
            onChange={(e) => {
              resetScroll();
              onQueryChange(e.target.value);
            }}
            placeholder="Search market..."
            className="pl-9 pr-8 bg-muted border-border rounded-control"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClearQuery}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:bg-transparent tap-highlight dark:hover:bg-transparent after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
            >
              <X className="size-icon" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex px-2 overflow-x-auto scrollbar-hide">
        {TAB_ORDER.map((tab) => {
          const catKey = TAB_TO_CATEGORY[tab];
          const isActive = category === catKey;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => {
                resetScroll();
                onCategoryChange(catKey);
              }}
              className={cn(
                "px-3 py-2 type-data font-medium whitespace-nowrap transition-colors cursor-pointer bg-transparent border-none -mb-px",
                isActive
                  ? "bg-(--control-active-bg) text-foreground border-b-2 border-info"
                  : "text-muted-foreground hover:bg-(--control-hover-bg) hover:text-foreground border-transparent",
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <MarketHeader columns={columns} sortBy={sortBy} sortDesc={sortDesc} onSort={onSort} />

      <div
        ref={scrollRef}
        className="max-h-[clamp(22rem,60dvh,34rem)] overflow-y-auto overscroll-none flex flex-col"
      >
        {isLoading ? (
          <div>
            {SKELETON_ROW_IDS.map((rowId) => (
              <MarketRowSkeleton key={rowId} columns={columns} />
            ))}
          </div>
        ) : hasError ? (
          <div className="flex flex-1 items-center justify-center min-h-[clamp(12rem,40dvh,18rem)]">
            <EmptyState variant="panel" title="Unable to load markets" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center min-h-[clamp(12rem,40dvh,18rem)]">
            <EmptyState
              variant="panel"
              title={query ? "No results" : "No markets found"}
              description={
                query
                  ? "Try a different search or filter."
                  : "No markets are available in this category."
              }
            />
          </div>
        ) : (
          <div style={{ paddingTop: topSpacer, paddingBottom: bottomSpacer }}>
            {windowRows.map((row, offset) => {
              const index = start + offset;
              const isActive = row.rawCoin.toLowerCase() === activeCoin;
              return (
                <button
                  key={row.key}
                  ref={index === start ? firstRowRef : undefined}
                  type="button"
                  onClick={() => {
                    onSelect(row);
                  }}
                  className={cn(
                    "w-full text-left transition-colors hover:bg-(--control-hover-bg) focus-visible:bg-(--control-hover-bg) focus-ring-inset cursor-pointer select-none tap-highlight",
                    isActive && "bg-(--control-active-bg)",
                  )}
                  aria-current={isActive ? "true" : undefined}
                >
                  <MarketRow row={row} columns={columns} version={dataVersion} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Surface>
  );
}
