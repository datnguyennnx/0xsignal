import type { JSX } from "react";
import type { WhalePositionSort, WhaleSide } from "@0xsignal/shared";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type SideFilter = "all" | WhaleSide;

export interface WhalePositionFilters {
  symbol: string;
  side: SideFilter;
  sort: WhalePositionSort;
}

export const DEFAULT_WHALE_FILTERS: WhalePositionFilters = {
  symbol: "",
  side: "all",
  sort: "notional",
};

const SELECT_CLASS =
  "border-border/40 bg-background/70 text-sm hover:bg-muted/40 focus-visible:ring-ring/40";

const SIDE_OPTIONS: { value: SideFilter; label: string }[] = [
  { value: "all", label: "All Sides" },
  { value: "buy", label: "Long" },
  { value: "sell", label: "Short" },
];

const SORT_OPTIONS: { value: WhalePositionSort; label: string }[] = [
  { value: "notional", label: "Notional" },
  { value: "pnl", label: "Unrealised PNL" },
  { value: "funding", label: "Funding" },
];

function isSideFilter(value: string): value is SideFilter {
  return value === "all" || value === "buy" || value === "sell";
}

function isPositionSort(value: string): value is WhalePositionSort {
  return value === "notional" || value === "pnl" || value === "funding";
}

interface WhalePositionFiltersBarProps {
  filters: WhalePositionFilters;
  onChange: (patch: Partial<WhalePositionFilters>) => void;
}

export function WhalePositionFiltersBar({
  filters,
  onChange,
}: WhalePositionFiltersBarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex items-center gap-2">
        <Input
          value={filters.symbol}
          onChange={(e) => {
            onChange({ symbol: e.target.value });
          }}
          placeholder="Symbol"
          aria-label="Filter by symbol"
          className="h-8 w-28"
        />
        <NativeSelect
          value={filters.side}
          onChange={(e) => {
            const value = e.target.value;
            if (isSideFilter(value)) onChange({ side: value });
          }}
          aria-label="Filter by side"
          className={SELECT_CLASS}
        >
          {SIDE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Sort</span>
        <NativeSelect
          value={filters.sort}
          onChange={(e) => {
            const value = e.target.value;
            if (isPositionSort(value)) onChange({ sort: value });
          }}
          aria-label="Sort positions by"
          className={SELECT_CLASS}
        >
          {SORT_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}
