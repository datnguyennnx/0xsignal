import { useEffect, useMemo, useRef, useState, type JSX } from "react";
import type {
  WhalePosition,
  WhalePositionSort,
  WhalePositionsQuery,
  WhaleSide,
} from "@0xsignal/shared";
import { cn } from "cn";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { truncateAddress } from "@/core/utils/address";
import {
  formatCompactUsd,
  formatPrice,
  formatSignedPercent,
  formatSignedUsd,
  formatSize,
} from "@/core/utils/formatters";

import { useWhalePositions } from "../hooks/use-whale-positions";

const HEAD_CLASS =
  "bg-muted text-[length:var(--text-data)] text-muted-foreground uppercase tracking-wider";
const NUM_CLASS = "text-right tabular-nums";
const SELECT_CLASS =
  "border-border/40 bg-background/70 text-sm hover:bg-muted/40 focus-visible:ring-ring/40";

type SideFilter = "all" | WhaleSide;

interface Filters {
  symbol: string;
  side: SideFilter;
  sort: WhalePositionSort;
}

const DEFAULT_FILTERS: Filters = {
  symbol: "",
  side: "all",
  sort: "notional",
};

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

const SKELETON_ROW_COUNT = 8;
const SKELETON_COLUMN_WIDTHS = [
  "w-4",
  "w-24",
  "w-10",
  "w-10",
  "w-16",
  "w-20",
  "w-16",
  "w-16",
  "w-14",
  "w-16",
  "w-16",
  "w-16",
  "w-20",
] as const;
const NUMERIC_COLUMN_INDEX = 4;

function toneClass(value: number): string {
  return value >= 0 ? "text-gain" : "text-loss";
}

function formatEntryTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface WhalePositionsTableProps {
  onSelectWallet: (address: string) => void;
  className?: string;
}

export function WhalePositionsTable({
  onSelectWallet,
  className,
}: WhalePositionsTableProps): JSX.Element {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<WhalePosition[]>([]);
  const lastAppendedCursorRef = useRef<string | undefined>(undefined);

  const filterQuery = useMemo<WhalePositionsQuery>(
    () => ({
      symbol: filters.symbol.trim() || undefined,
      side: filters.side === "all" ? undefined : filters.side,
      sort: filters.sort,
    }),
    [filters],
  );

  const query = useMemo(() => ({ ...filterQuery, cursor }), [filterQuery, cursor]);

  const { data, isLoading, isFetching } = useWhalePositions(query);

  function updateFilters(patch: Partial<Filters>): void {
    setFilters((prev) => ({ ...prev, ...patch }));
    setCursor(undefined);
  }

  useEffect(() => {
    if (!data) return;
    if (cursor === undefined) {
      lastAppendedCursorRef.current = undefined;
      setRows(data.positions);
    } else if (cursor !== lastAppendedCursorRef.current) {
      lastAppendedCursorRef.current = cursor;
      setRows((prev) => [...prev, ...data.positions]);
    }
  }, [data, cursor]);

  const showLoading = isLoading && rows.length === 0;
  const nextCursor = data?.nextCursor ?? undefined;
  const hasActiveFilters = filters.symbol.trim() !== "" || filters.side !== "all";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Input
            value={filters.symbol}
            onChange={(e) => updateFilters({ symbol: e.target.value })}
            placeholder="Symbol"
            aria-label="Filter by symbol"
            className="h-8 w-28"
          />
          <NativeSelect
            value={filters.side}
            onChange={(e) => updateFilters({ side: e.target.value as SideFilter })}
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
            onChange={(e) => updateFilters({ sort: e.target.value as WhalePositionSort })}
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

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className={HEAD_CLASS}>#</TableHead>
            <TableHead className={HEAD_CLASS}>User</TableHead>
            <TableHead className={HEAD_CLASS}>Assets</TableHead>
            <TableHead className={HEAD_CLASS}>Side</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Position</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Unrealised PNL</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Entry Price</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Liq.Price</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Margin</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Mode</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Funding Fee</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Price</TableHead>
            <TableHead className={cn(HEAD_CLASS, NUM_CLASS)}>Entry Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {showLoading ? (
            Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
              <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
                {SKELETON_COLUMN_WIDTHS.map((width, columnIndex) => (
                  <TableCell
                    key={columnIndex}
                    className={columnIndex >= NUMERIC_COLUMN_INDEX ? NUM_CLASS : undefined}
                  >
                    <Skeleton
                      className={cn("h-4", width, columnIndex >= NUMERIC_COLUMN_INDEX && "ml-auto")}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={13} className="py-10">
                {hasActiveFilters ? (
                  <div className="flex flex-col items-center gap-3">
                    <EmptyState
                      variant="table"
                      title="No matching positions"
                      description="No positions match the current filters."
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFilters(DEFAULT_FILTERS)}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <EmptyState
                    variant="table"
                    title="No whale positions"
                    description="Positions will appear here once whale activity is detected."
                  />
                )}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((position: WhalePosition, index: number) => (
              <TableRow
                key={`${position.userAddress}-${position.coin}-${position.entryTime}-${index}`}
                onClick={() => onSelectWallet(position.userAddress)}
                className="cursor-pointer"
              >
                <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="link"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWallet(position.userAddress);
                    }}
                    className="h-auto p-0"
                  >
                    {truncateAddress(position.userAddress)}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">{position.coin}</TableCell>
                <TableCell>
                  <span className={position.side === "buy" ? "text-gain" : "text-loss"}>
                    {position.side === "buy" ? "Long" : "Short"}
                  </span>
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  <div className="font-medium">{formatCompactUsd(position.notionalUsd)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatSize(position.size)} {position.coin}
                  </div>
                </TableCell>
                <TableCell className={cn(NUM_CLASS, toneClass(position.unrealizedPnl))}>
                  <div className="font-medium">{formatSignedUsd(position.unrealizedPnl)}</div>
                  <div className="text-xs">{formatSignedPercent(position.unrealizedPnlPct)}</div>
                </TableCell>
                <TableCell className={NUM_CLASS}>{formatPrice(Number(position.entryPx))}</TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.liquidationPx ? formatPrice(Number(position.liquidationPx)) : "—"}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.marginUsd != null ? formatCompactUsd(position.marginUsd) : "—"}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.leverageType === "isolated"
                    ? "Isolated"
                    : position.leverageType === "cross"
                      ? "Cross"
                      : "—"}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.fundingFee != null ? (
                    <span className={toneClass(position.fundingFee)}>
                      {formatSignedUsd(position.fundingFee)}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.markPrice ? formatPrice(Number(position.markPrice)) : "—"}
                </TableCell>
                <TableCell className={cn(NUM_CLASS, "text-muted-foreground")}>
                  {formatEntryTime(position.entryTime)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {nextCursor && (
        <div className="flex justify-center border-t py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => setCursor(nextCursor)}
          >
            {isFetching ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
