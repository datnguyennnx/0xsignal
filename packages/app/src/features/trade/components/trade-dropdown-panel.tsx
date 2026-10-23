import type { RefObject } from "react";
import { Search, X } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { cn } from "cn";
import { OVERLAY_PANEL_CLASS } from "@/lib/overlay-classes";
import { MarketHeader, MarketRow, MarketRowSkeleton } from "./trade-dropdown.columns";
import { getColumns } from "../utils/trade-dropdown-columns";
import { TAB_ORDER, TAB_TO_CATEGORY } from "../utils/trade-dropdown";
import type { CategoryTab, FormattedTrade } from "../utils/trade-dropdown";

const SKELETON_ROW_IDS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"] as const;

interface TradeDropdownPanelProps {
  id: string;
  position: { top: number; left: number };
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  onQueryChange: (query: string) => void;
  category: CategoryTab;
  onCategoryChange: (category: CategoryTab) => void;
  sortBy: "name" | "change";
  sortDesc: boolean;
  onSort: (field: "name" | "change") => void;
  formattedTrades: FormattedTrade[];
  isLoading: boolean;
  hasError: boolean;
  onSelect: (asset: { rawCoin: string }) => void;
}

export function TradeDropdownPanel({
  id,
  position,
  inputRef,
  query,
  onQueryChange,
  category,
  onCategoryChange,
  sortBy,
  sortDesc,
  onSort,
  formattedTrades,
  isLoading,
  hasError,
  onSelect,
}: TradeDropdownPanelProps) {
  const columns = getColumns(category);

  return (
    <div
      id={id}
      className={cn(
        OVERLAY_PANEL_CLASS,
        "fixed z-50 w-[calc(100vw-16px)] sm:w-[90vw] max-w-[56rem]",
      )}
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
          <label htmlFor="trade-dropdown-search" className="sr-only">
            Search markets
          </label>
          <Input
            id="trade-dropdown-search"
            ref={inputRef}
            value={query}
            onChange={(e) => {
              onQueryChange(e.target.value);
            }}
            placeholder="Search market..."
            className="pl-9 pr-8 bg-muted border-border h-10 text-sm rounded-lg focus:ring-1 focus:ring-offset-0"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                onQueryChange("");
              }}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground/60 hover:text-foreground bg-transparent border-none cursor-pointer tap-highlight"
            >
              <X className="w-4 h-4" />
            </button>
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
                onCategoryChange(catKey);
              }}
              className={cn(
                "px-3 py-2 text-[length:var(--text-data)] font-medium whitespace-nowrap transition-colors cursor-pointer bg-transparent border-none -mb-px",
                isActive
                  ? "text-foreground border-b-2 border-foreground"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <MarketHeader columns={columns} sortBy={sortBy} sortDesc={sortDesc} onSort={onSort} />

      <div className="max-h-[clamp(22rem,60dvh,34rem)] overflow-y-auto overscroll-none flex flex-col">
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
        ) : formattedTrades.length === 0 ? (
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
          <div>
            {formattedTrades.map((item) => (
              <button
                key={`${item.rawCoin}-${item.dexPrefix ?? "main"}-${item.marketType}`}
                type="button"
                onClick={() => {
                  onSelect(item);
                }}
                className={cn(
                  "w-full text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-inset cursor-pointer select-none tap-highlight",
                  item.isActive && "bg-muted/60",
                )}
                aria-current={item.isActive ? "true" : undefined}
              >
                <MarketRow item={item} columns={columns} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
