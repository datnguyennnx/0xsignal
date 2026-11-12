import { useCallback, useEffect, type RefObject, type UIEvent } from "react";
import { Surface } from "@/components/surface/surface";
import { MarketHeader } from "./trade-dropdown.columns";
import { getColumns } from "../utils/trade-dropdown-columns";
import { type CategoryTab } from "../utils/trade-dropdown";
import { type MarketWindow } from "../lib/market-window";
import { type VisibleCoinRows } from "../lib/visible-coins";
import { prewarmMarketCells } from "../lib/format-trade-rows";
import { TradeListView, TradeSearch, TradeTabs } from "./trade-dropdown-panel-parts";

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
  rows: VisibleCoinRows;
  currentSymbol: string;
  dataVersion: number;
  state: { status: "idle" | "loading" | "ready" | "empty" | "error" };
  onRetry: () => void;
  onSelect: (asset: { rawCoin: string }) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  firstRowRef: RefObject<HTMLButtonElement | null>;
  rowHeight: number;
  range: MarketWindow;
}

interface TradeDropdownControlsOptions {
  scrollRef: RefObject<HTMLDivElement | null>;
  rows: VisibleCoinRows;
  activeCoin: string;
  rowHeight: number;
  dataVersion: number;
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: CategoryTab) => void;
}

function useTradeDropdownControls({
  scrollRef,
  rows,
  activeCoin,
  rowHeight,
  dataVersion,
  onQueryChange,
  onCategoryChange,
}: TradeDropdownControlsOptions) {
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
  }, [rows, activeCoin, rowHeight, scrollRef]);

  // Warm the next screen while idle; the scheduler cancels when the panel closes.
  useEffect(() => {
    if (rows.length === 0) return () => {};
    return scheduleIdle(() => {
      prewarmMarketCells(rows, dataVersion, PREWARM_ROWS);
    });
  }, [rows, dataVersion]);

  // Focus the dialog itself, never the search field: the input's focus ring must
  // not paint on open, and Escape still arrives through the window listener.
  useEffect(() => {
    scrollRef.current?.closest<HTMLElement>('[role="dialog"]')?.focus();
  }, [scrollRef]);

  // A tab or query swap replaces the list, so keep the new list anchored at the
  // top instead of stranding the user at the old offset (possibly past the end).
  const resetScroll = useCallback(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = 0;
  }, [scrollRef]);

  const handleQueryChange = useCallback(
    (next: string) => {
      resetScroll();
      onQueryChange(next);
    },
    [onQueryChange, resetScroll],
  );

  const handleClearQuery = useCallback(() => {
    resetScroll();
    onQueryChange("");
  }, [onQueryChange, resetScroll]);

  const handleCategoryChange = useCallback(
    (next: CategoryTab) => {
      resetScroll();
      onCategoryChange(next);
    },
    [onCategoryChange, resetScroll],
  );

  return { handleQueryChange, handleClearQuery, handleCategoryChange };
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
  state,
  onRetry,
  onSelect,
  onScroll,
  scrollRef,
  firstRowRef,
  rowHeight,
  range,
}: TradeDropdownPanelProps) {
  const columns = getColumns(category);
  const activeCoin = currentSymbol.toLowerCase();

  const { handleQueryChange, handleClearQuery, handleCategoryChange } = useTradeDropdownControls({
    scrollRef,
    rows,
    activeCoin,
    rowHeight,
    dataVersion,
    onQueryChange,
    onCategoryChange,
  });

  const { start, end, topSpacer, bottomSpacer } = range;

  return (
    <Surface
      id={id}
      tier="floating"
      radius="overlay"
      material="glass"
      thickness="regular"
      role="dialog"
      aria-label="Select market"
      tabIndex={-1}
      className="fixed z-50 flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden outline-none w-[calc(100vw-16px)] sm:w-[90vw] max-w-[62rem] text-popover-foreground"
      style={{ top: position.top, left: position.left }}
    >
      <TradeSearch query={query} onQueryChange={handleQueryChange} onClear={handleClearQuery} />
      <TradeTabs category={category} onCategoryChange={handleCategoryChange} />

      <div className="shrink-0">
        <MarketHeader columns={columns} sortBy={sortBy} sortDesc={sortDesc} onSort={onSort} />
      </div>

      <TradeListView
        state={state}
        query={query}
        onRetry={onRetry}
        rows={rows}
        start={start}
        end={end}
        topSpacer={topSpacer}
        bottomSpacer={bottomSpacer}
        activeCoin={activeCoin}
        columns={columns}
        dataVersion={dataVersion}
        firstRowRef={firstRowRef}
        onSelect={onSelect}
        onScroll={onScroll}
        scrollRef={scrollRef}
        rowHeight={rowHeight}
      />
    </Surface>
  );
}
