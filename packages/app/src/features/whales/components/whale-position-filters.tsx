import type { JSX } from "react";
import type { WhalePositionSort } from "@0xsignal/shared";

import { Input } from "@/components/ui/input";
import { Segmented, type SegmentedOption } from "@/components/ui/segmented";

import type { SideFilter, WhalePositionFilters } from "./whale-filter-defaults";

const SIDE_OPTIONS: readonly SegmentedOption<SideFilter>[] = [
  { value: "all", label: "All" },
  { value: "buy", label: "Long" },
  { value: "sell", label: "Short" },
];

const SORT_OPTIONS: readonly SegmentedOption<WhalePositionSort>[] = [
  { value: "notional", label: "Notional" },
  { value: "pnl", label: "Unrealised PNL" },
  { value: "funding", label: "Funding" },
];

interface WhalePositionFiltersBarProps {
  filters: WhalePositionFilters;
  onChange: (patch: Partial<WhalePositionFilters>) => void;
  symbolInput: string;
  onSymbolChange: (value: string) => void;
  onSymbolSubmit: () => void;
  knownSymbols: readonly string[];
  symbolUnknown: boolean;
}

export function WhalePositionFiltersBar({
  filters,
  onChange,
  symbolInput,
  onSymbolChange,
  onSymbolSubmit,
  symbolUnknown,
}: WhalePositionFiltersBarProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="relative flex w-[18rem] max-w-full flex-col gap-1.5">
        <label htmlFor="whale-symbol" className="type-label font-medium text-muted-foreground">
          Symbol
        </label>
        <Input
          id="whale-symbol"
          value={symbolInput}
          onChange={(e) => {
            onSymbolChange(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSymbolSubmit();
          }}
          placeholder="e.g. BTC"
          aria-label="Filter by symbol"
          aria-invalid={symbolUnknown}
          className="h-control w-full"
        />
        {symbolUnknown && (
          <span className="type-label absolute top-full left-0 mt-1 text-muted-foreground">
            Unknown symbol
          </span>
        )}
      </div>
      <div className="flex w-auto flex-col gap-1.5">
        <span className="type-label font-medium text-muted-foreground">Side</span>
        <Segmented
          options={SIDE_OPTIONS}
          value={filters.side}
          onValueChange={(side) => {
            onChange({ side });
          }}
          aria-label="Side"
        />
      </div>
      <div className="flex w-auto flex-col gap-1.5">
        <span className="type-label font-medium text-muted-foreground">Sort</span>
        <Segmented
          options={SORT_OPTIONS}
          value={filters.sort}
          onValueChange={(sort) => {
            onChange({ sort });
          }}
          aria-label="Sort"
        />
      </div>
    </div>
  );
}
