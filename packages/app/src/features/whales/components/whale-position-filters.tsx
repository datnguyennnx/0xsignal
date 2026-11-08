import type { JSX } from "react";
import type { WhalePositionSort } from "@0xsignal/shared";

import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

import type { SideFilter, WhalePositionFilters } from "./whale-filter-defaults";

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
  symbolInput: string;
  onSymbolChange: (value: string) => void;
}

export function WhalePositionFiltersBar({
  filters,
  onChange,
  symbolInput,
  onSymbolChange,
}: WhalePositionFiltersBarProps): JSX.Element {
  return (
    <div data-dense className="flex flex-wrap items-center gap-inline px-4 py-2">
      <div className="flex items-center gap-inline">
        <Input
          value={symbolInput}
          onChange={(e) => {
            onSymbolChange(e.target.value);
          }}
          placeholder="Symbol"
          aria-label="Filter by symbol"
          className="w-28"
        />
        <NativeSelect
          value={filters.side}
          onChange={(e) => {
            const value = e.target.value;
            if (isSideFilter(value)) onChange({ side: value });
          }}
          aria-label="Filter by side"
          className="border-control-border bg-input"
        >
          {SIDE_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div className="ml-auto flex items-center gap-inline">
        <span className="type-label text-muted-foreground">Sort</span>
        <NativeSelect
          value={filters.sort}
          onChange={(e) => {
            const value = e.target.value;
            if (isPositionSort(value)) onChange({ sort: value });
          }}
          aria-label="Sort positions by"
          className="border-control-border bg-input"
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
