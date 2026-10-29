import { useMemo, useState, type JSX } from "react";
import type { WhalePosition, WhalePositionsQuery } from "@0xsignal/shared";
import { cn } from "cn";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatCompactUsd,
  formatPrice,
  formatSignedPercent,
  formatSignedUsd,
  formatSize,
  truncateAddress,
} from "@/core/utils/formatters";

import { useWhalePositions } from "../hooks/use-whale-positions";
import { WhalePositionFiltersBar } from "./whale-position-filters";
import {
  DEFAULT_WHALE_FILTERS,
  type WhalePositionFilters,
} from "./whale-position-filters.constants";

const HEAD_CLASS =
  "bg-muted text-[length:var(--text-data)] text-muted-foreground uppercase tracking-wider";
const NUM_CLASS = "text-right tabular-nums";

const SKELETON_ROW_KEYS = Array.from({ length: 8 }, (_, index) => `whale-row-${index}`);
// Loaded cells stack a text-sm line over a text-xs line; the skeleton mirrors both
// line boxes so a row reserves its final height before the data arrives.
const SKELETON_LINE_CLASSES = ["h-5", "h-4"] as const;
const SKELETON_COLUMNS: { id: string; width: string; lines: number }[] = [
  { id: "rank", width: "w-4", lines: 1 },
  { id: "user", width: "w-24", lines: 1 },
  { id: "assets", width: "w-10", lines: 1 },
  { id: "side", width: "w-10", lines: 1 },
  { id: "position", width: "w-16", lines: 2 },
  { id: "pnl", width: "w-20", lines: 2 },
  { id: "entry", width: "w-16", lines: 1 },
  { id: "liquidation", width: "w-16", lines: 1 },
  { id: "margin", width: "w-14", lines: 1 },
  { id: "mode", width: "w-16", lines: 1 },
  { id: "funding", width: "w-16", lines: 1 },
  { id: "price", width: "w-16", lines: 1 },
  { id: "time", width: "w-20", lines: 1 },
];
const NUMERIC_COLUMN_INDEX = 4;
const COLUMN_COUNT = SKELETON_COLUMNS.length;

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
  const [filters, setFilters] = useState<WhalePositionFilters>(DEFAULT_WHALE_FILTERS);

  const query = useMemo<WhalePositionsQuery>(
    () => ({
      symbol: filters.symbol.trim() || undefined,
      side: filters.side === "all" ? undefined : filters.side,
      sort: filters.sort,
    }),
    [filters],
  );

  const { data, isLoading, isFetching, hasNextPage, fetchNextPage } = useWhalePositions(query);

  const rows = useMemo(() => data?.pages.flatMap((page) => page.positions) ?? [], [data]);

  const showLoading = isLoading && rows.length === 0;
  const hasActiveFilters = filters.symbol.trim() !== "" || filters.side !== "all";

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <WhalePositionFiltersBar
        filters={filters}
        onChange={(patch) => {
          setFilters((prev) => ({ ...prev, ...patch }));
        }}
      />

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
            SKELETON_ROW_KEYS.map((rowKey) => (
              <TableRow key={rowKey} className="hover:bg-transparent">
                {SKELETON_COLUMNS.map((column, columnIndex) => (
                  <TableCell
                    key={column.id}
                    className={columnIndex >= NUMERIC_COLUMN_INDEX ? NUM_CLASS : undefined}
                  >
                    <div
                      className={cn(
                        "flex flex-col",
                        columnIndex >= NUMERIC_COLUMN_INDEX && "items-end",
                      )}
                    >
                      {SKELETON_LINE_CLASSES.slice(0, column.lines).map((lineClass) => (
                        <Skeleton key={lineClass} className={cn(lineClass, column.width)} />
                      ))}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className="py-10">
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
                      onClick={() => {
                        setFilters(DEFAULT_WHALE_FILTERS);
                      }}
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
                key={`${position.userAddress}-${position.coin}-${position.entryTime}`}
                onClick={() => {
                  onSelectWallet(position.userAddress);
                }}
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
                  {position.liquidationPx === undefined || position.liquidationPx === ""
                    ? "—"
                    : formatPrice(Number(position.liquidationPx))}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.marginUsd == null ? "—" : formatCompactUsd(position.marginUsd)}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.leverageType === "isolated"
                    ? "Isolated"
                    : position.leverageType === "cross"
                      ? "Cross"
                      : "—"}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.fundingFee == null ? (
                    "—"
                  ) : (
                    <span className={toneClass(position.fundingFee)}>
                      {formatSignedUsd(position.fundingFee)}
                    </span>
                  )}
                </TableCell>
                <TableCell className={NUM_CLASS}>
                  {position.markPrice === undefined || position.markPrice === ""
                    ? "—"
                    : formatPrice(Number(position.markPrice))}
                </TableCell>
                <TableCell className={cn(NUM_CLASS, "text-muted-foreground")}>
                  {formatEntryTime(position.entryTime)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center border-t py-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => {
              void fetchNextPage();
            }}
          >
            {isFetching ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
