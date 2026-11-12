import type { RefObject, UIEvent } from "react";
import { Search, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketRow } from "./market-row";
import { TAB_ORDER, TAB_TO_CATEGORY, type CategoryTab } from "../utils/trade-dropdown";
import type { ColumnDef } from "../utils/trade-dropdown-columns";
import type { MarketRowData } from "../lib/market-row-data";
import { PANEL_LIST_ROW_COUNT } from "../lib/overlay-position";

type PanelStatus = "idle" | "loading" | "ready" | "empty" | "error";

export function TradeSearch({
  query,
  onQueryChange,
  onClear,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="p-3 shrink-0">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-icon text-muted-foreground" />
        <label htmlFor="trade-dropdown-search" className="sr-only">
          Search markets
        </label>
        <Input
          id="trade-dropdown-search"
          value={query}
          onChange={(e) => {
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
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:bg-transparent tap-highlight dark:hover:bg-transparent after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-x-1/2 after:-translate-y-1/2"
          >
            <X className="size-icon" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function TradeTabs({
  category,
  onCategoryChange,
}: {
  category: CategoryTab;
  onCategoryChange: (category: CategoryTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Market categories"
      className="flex shrink-0 items-center gap-1 rounded-control px-(--seg-inset) py-[calc(var(--seg-inset)_+_0.175rem)] -my-1 mx-1 overflow-x-auto scrollbar-hide"
    >
      {TAB_ORDER.map((tab) => {
        const catKey = TAB_TO_CATEGORY[tab];
        const isActive = category === catKey;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? "" : undefined}
            onClick={() => {
              onCategoryChange(catKey);
            }}
            className={`px-3 py-2 type-data font-medium whitespace-nowrap transition-colors cursor-pointer bg-transparent border-none focus-ring rounded-[calc(var(--radius-control)-var(--seg-inset))] ${
              isActive
                ? "bg-(--control-active-bg) text-foreground shadow-[inset_0_0_0_1px_var(--border)]"
                : "text-muted-foreground hover:bg-(--control-hover-bg) hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}

function TradeListStatus({
  status,
  query,
  onRetry,
  isEmpty,
}: {
  status: PanelStatus;
  query: string;
  onRetry: () => void;
  isEmpty: boolean;
}) {
  if (status === "loading" || status === "idle") return null;

  if (status === "error") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[clamp(12rem,40dvh,18rem)]">
        <ErrorState title="Unable to load markets" retryAction={onRetry} />
      </div>
    );
  }

  if (!isEmpty) return null;

  return (
    <div className="flex flex-1 items-center justify-center min-h-[clamp(12rem,40dvh,18rem)]">
      <EmptyState
        variant="panel"
        title={query ? "No results" : "No markets found"}
        description={
          query ? "Try a different search or filter." : "No markets are available in this category."
        }
      />
    </div>
  );
}

function TradeResultRow({
  row,
  index,
  start,
  activeCoin,
  columns,
  dataVersion,
  firstRowRef,
  onSelect,
}: {
  row: MarketRowData;
  index: number;
  start: number;
  activeCoin: string;
  columns: ColumnDef[];
  dataVersion: number;
  firstRowRef: RefObject<HTMLButtonElement | null>;
  onSelect: (asset: { rawCoin: string }) => void;
}) {
  const isActive = row.rawCoin.toLowerCase() === activeCoin;
  return (
    <button
      ref={index === start ? firstRowRef : undefined}
      type="button"
      onClick={() => {
        onSelect(row);
      }}
      data-active={isActive ? "true" : "false"}
      className={`w-full text-left transition-colors focus-ring-inset cursor-pointer select-none tap-highlight data-[active=false]:hover:bg-(--control-hover-bg) data-[active=false]:focus-visible:bg-(--control-hover-bg) ${
        isActive ? "bg-(--control-active-bg)" : ""
      }`}
      aria-current={isActive ? "true" : undefined}
    >
      <MarketRow row={row} columns={columns} version={dataVersion} />
    </button>
  );
}

export function TradeListView({
  state,
  query,
  onRetry,
  rows,
  start,
  end,
  topSpacer,
  bottomSpacer,
  activeCoin,
  columns,
  dataVersion,
  firstRowRef,
  onSelect,
  onScroll,
  scrollRef,
  rowHeight,
}: {
  state: { status: PanelStatus };
  query: string;
  onRetry: () => void;
  rows: readonly MarketRowData[];
  start: number;
  end: number;
  topSpacer: number;
  bottomSpacer: number;
  activeCoin: string;
  columns: ColumnDef[];
  dataVersion: number;
  firstRowRef: RefObject<HTMLButtonElement | null>;
  onSelect: (asset: { rawCoin: string }) => void;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  rowHeight: number;
}) {
  const isLoading = state.status === "loading" || state.status === "idle";
  const showRows = !isLoading && state.status !== "error" && rows.length > 0;
  const windowRows = rows.slice(start, end);

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-auto overflow-y-auto overscroll-none flex flex-col"
      style={{ maxHeight: PANEL_LIST_ROW_COUNT * rowHeight }}
    >
      <TradeListStatus
        status={state.status}
        query={query}
        onRetry={onRetry}
        isEmpty={rows.length === 0}
      />
      {showRows && (
        <div style={{ paddingTop: topSpacer, paddingBottom: bottomSpacer }}>
          {windowRows.map((row, offset) => {
            const index = start + offset;
            return (
              <TradeResultRow
                key={row.key}
                row={row}
                index={index}
                start={start}
                activeCoin={activeCoin}
                columns={columns}
                dataVersion={dataVersion}
                firstRowRef={firstRowRef}
                onSelect={onSelect}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
