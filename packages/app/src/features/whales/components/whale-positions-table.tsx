import { memo, useDeferredValue, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { cn } from "cn";

import { computeWindow } from "@/features/trade/lib/market-window";
import { useOpenCoin } from "@/components/app-side-panel";
import { preloadRoute } from "@/lib/preload-routes";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
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
  formatSignedPercent,
  formatSignedUsd,
  formatSize,
} from "@/core/utils/formatters";

import {
  dedupeWhalePositions,
  useWhalePositions,
  whalePositionRowKey,
} from "../hooks/use-whale-positions";
import { WhalePositionFiltersBar } from "./whale-position-filters";
import { DEFAULT_WHALE_FILTERS, type WhalePositionFilters } from "./whale-filter-defaults";
import {
  areWhaleRowPropsEqual,
  formatEntryTime,
  formatWhalePrice,
  type WhalePositionRowProps,
} from "./whale-positions-table-format";

const CELL_CLASS = "px-2 py-1";

type ColumnRole = "text" | "num" | "addr";

const ROLE_CLASS: Record<ColumnRole, string> = {
  text: "col-text",
  num: "col-num",
  addr: "col-addr",
};

interface Column {
  id: string;
  label: string;
  role: ColumnRole;
  /** Skeleton bar width only; the column itself is sized by its header. */
  bar: string;
  lines: 1 | 2;
}

/** One descriptor drives the header, the skeleton and the body roles, so widths cannot drift. */
const COLUMNS: readonly Column[] = [
  { id: "rank", label: "#", role: "text", bar: "w-4", lines: 1 },
  { id: "user", label: "User", role: "addr", bar: "w-3/4", lines: 1 },
  { id: "asset", label: "Asset", role: "text", bar: "w-8", lines: 1 },
  { id: "side", label: "Side", role: "text", bar: "w-8", lines: 1 },
  { id: "position", label: "Position", role: "num", bar: "w-3/4", lines: 2 },
  { id: "pnl", label: "PnL", role: "num", bar: "w-3/4", lines: 2 },
  { id: "entry", label: "Entry Price", role: "num", bar: "w-3/4", lines: 1 },
  { id: "liquidation", label: "Liq. Price", role: "num", bar: "w-3/4", lines: 1 },
  { id: "margin", label: "Margin", role: "num", bar: "w-1/2", lines: 1 },
  { id: "mode", label: "Mode", role: "text", bar: "w-2/3", lines: 1 },
  { id: "funding", label: "Funding Fee", role: "num", bar: "w-3/4", lines: 1 },
  { id: "price", label: "Price", role: "num", bar: "w-3/4", lines: 1 },
  { id: "time", label: "Entry Time", role: "text", bar: "w-3/4", lines: 1 },
];

const SKELETON_ROW_KEYS = Array.from({ length: 8 }, (_, index) => `whale-row-${index}`);
/** Every data column; the table fills width so no trailing spacer is needed. */
const COLUMN_COUNT = COLUMNS.length;

/** Fallback until a real body row is measured; the row is ~two lines at the default density. */
const ROW_HEIGHT = 44;
const OVERSCAN = 8;

/** `Table` owns the overflow container; its data attribute is the stable handle to it. */
function resolveScrollContainer(table: HTMLTableElement | null): HTMLDivElement | null {
  return table?.closest<HTMLDivElement>('[data-slot="table-container"]') ?? null;
}

function toneClass(value: number): string {
  return value >= 0 ? "text-gain" : "text-loss";
}

/** A spacer keeps the scrollbar honest while the window renders only the visible slice. */
function SpacerRow({ height }: { readonly height: number }): JSX.Element | null {
  if (height <= 0) return null;
  return (
    <TableRow aria-hidden className="border-0 hover:bg-transparent">
      <TableCell colSpan={COLUMN_COUNT} className="p-0" style={{ height }} />
    </TableRow>
  );
}

interface WhalePositionsTableProps {
  onSelectWallet: (address: string) => void;
}

const WhalePositionRow = memo(function WhalePositionRow({
  position,
  index,
  onSelectWallet,
  onOpenCoin,
}: WhalePositionRowProps) {
  const walletPath = `/whales/${position.userAddress}`;
  return (
    <TableRow
      tabIndex={0}
      aria-label={`Open ${position.coin} position for ${position.userAddress}`}
      onMouseEnter={() => {
        preloadRoute(walletPath);
      }}
      onFocus={() => {
        preloadRoute(walletPath);
      }}
      onClick={() => {
        onSelectWallet(position.userAddress);
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelectWallet(position.userAddress);
      }}
      className="cursor-pointer focus-ring-inset"
    >
      <TableCell className={cn(CELL_CLASS, "text-muted-foreground num")}>{index + 1}</TableCell>
      <TableCell className={cn(CELL_CLASS, "col-addr")}>
        <Button
          type="button"
          variant="link"
          onClick={(e) => {
            e.stopPropagation();
            onSelectWallet(position.userAddress);
          }}
          size="auto"
          className="block w-0 min-w-full truncate text-left"
          title={position.userAddress}
        >
          {position.userAddress}
        </Button>
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "font-medium")}>
        <Button
          type="button"
          variant="link"
          onClick={(e) => {
            e.stopPropagation();
            onOpenCoin(position.coin);
          }}
          size="auto"
        >
          {position.coin}
        </Button>
      </TableCell>
      <TableCell className={CELL_CLASS}>
        <span className={position.side === "buy" ? "text-gain" : "text-loss"}>
          {position.side === "buy" ? "Long" : "Short"}
        </span>
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        <div className="font-medium">{formatCompactUsd(position.notionalUsd)}</div>
        <div className="type-label text-muted-foreground">
          {formatSize(position.size)} {position.coin}
        </div>
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num", toneClass(position.unrealizedPnl))}>
        <div className="font-medium">{formatSignedUsd(position.unrealizedPnl)}</div>
        <div className="type-label">{formatSignedPercent(position.unrealizedPnlPct)}</div>
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        {formatWhalePrice(Number(position.entryPx))}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        {position.liquidationPx === undefined || position.liquidationPx === ""
          ? "—"
          : formatWhalePrice(Number(position.liquidationPx))}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        {position.marginUsd == null ? "—" : formatCompactUsd(position.marginUsd)}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-text")}>
        {position.leverageType === "isolated"
          ? "Isolated"
          : position.leverageType === "cross"
            ? "Cross"
            : "—"}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        {position.fundingFee == null ? (
          "—"
        ) : (
          <span className={toneClass(position.fundingFee)}>
            {formatSignedUsd(position.fundingFee)}
          </span>
        )}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        {position.markPrice === undefined || position.markPrice === ""
          ? "—"
          : formatWhalePrice(Number(position.markPrice))}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-text text-muted-foreground")}>
        {formatEntryTime(position.entryTime)}
      </TableCell>
    </TableRow>
  );
}, areWhaleRowPropsEqual);

export function WhalePositionsTable({ onSelectWallet }: WhalePositionsTableProps): JSX.Element {
  const [filters, setFilters] = useState<WhalePositionFilters>(DEFAULT_WHALE_FILTERS);
  const [symbolInput, setSymbolInput] = useState(DEFAULT_WHALE_FILTERS.symbol);
  const deferredSymbol = useDeferredValue(symbolInput);
  const openCoin = useOpenCoin();

  const query = useMemo(
    () => ({
      symbol: deferredSymbol.trim() || undefined,
      side: filters.side === "all" ? undefined : filters.side,
      sort: filters.sort,
    }),
    [deferredSymbol, filters.side, filters.sort],
  );

  const { data, isLoading, isFetching, isError, refetch, hasNextPage, fetchNextPage } =
    useWhalePositions(query);

  const rows = useMemo(() => dedupeWhalePositions(data?.pages), [data]);

  const tableRef = useRef<HTMLTableElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [rowHeight, setRowHeight] = useState(ROW_HEIGHT);

  // A passive scroll listener coalesces to one state update per animation frame.
  useEffect(() => {
    const element = resolveScrollContainer(tableRef.current);
    if (element === null) return () => {};

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

  // Measure the viewport and one real row; never measure inside onScroll.
  useEffect(() => {
    const element = resolveScrollContainer(tableRef.current);
    if (element === null) return () => {};

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
    if (rows.length > 0) {
      const firstRow = element.querySelector("tbody tr");
      if (firstRow instanceof HTMLElement) observer.observe(firstRow);
    }
    return () => {
      observer.disconnect();
    };
  }, [rows.length]);

  const { start, end, topSpacer, bottomSpacer } = computeWindow({
    scrollTop,
    viewportHeight,
    rowHeight,
    total: rows.length,
    overscan: OVERSCAN,
  });
  const windowRows = rows.slice(start, end);

  const showLoading = isLoading && rows.length === 0;
  const showError = isError && rows.length === 0;
  const hasActiveFilters = deferredSymbol.trim() !== "" || filters.side !== "all";

  return (
    <>
      <WhalePositionFiltersBar
        filters={filters}
        onChange={(patch) => {
          setFilters((prev) => ({ ...prev, ...patch }));
        }}
        symbolInput={symbolInput}
        onSymbolChange={setSymbolInput}
      />

      <Table ref={tableRef} aria-label="Whale positions" className="table-cull">
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead
                key={column.id}
                className={cn(
                  ROLE_CLASS[column.role],
                  column.role === "num" && "whitespace-nowrap",
                )}
              >
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {showLoading ? (
            SKELETON_ROW_KEYS.map((rowKey) => (
              <TableRow key={rowKey} className="hover:bg-transparent">
                {COLUMNS.map((column) => (
                  <TableCell key={column.id} className={cn(CELL_CLASS, ROLE_CLASS[column.role])}>
                    <div className={cn("flex flex-col", column.role === "num" && "items-end")}>
                      <Skeleton className={cn("h-[1.35em] type-data", column.bar)} />
                      {column.lines === 2 && <Skeleton className="h-[1.2em] w-1/2 type-label" />}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : showError ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className={cn(CELL_CLASS, "py-6")}>
                <ErrorState
                  title="Unable to load whale positions"
                  retryAction={() => {
                    void refetch();
                  }}
                />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMN_COUNT} className={cn(CELL_CLASS, "py-6")}>
                {hasActiveFilters ? (
                  <div className="flex flex-col items-center gap-inline">
                    <EmptyState
                      variant="table"
                      title="No matching positions"
                      description="No positions match the current filters."
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        setFilters(DEFAULT_WHALE_FILTERS);
                        setSymbolInput(DEFAULT_WHALE_FILTERS.symbol);
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
            <>
              <SpacerRow height={topSpacer} />
              {windowRows.map((position, offset) => (
                <WhalePositionRow
                  key={whalePositionRowKey(position)}
                  position={position}
                  index={start + offset}
                  onSelectWallet={onSelectWallet}
                  onOpenCoin={openCoin}
                />
              ))}
              <SpacerRow height={bottomSpacer} />
            </>
          )}
        </TableBody>
      </Table>

      {hasNextPage && (
        <div className="flex justify-center border-t py-2">
          {/* The trigger sits outside the scroll container, so it stays reachable while a page appends to the window's source list. */}
          <Button
            variant="outline"
            disabled={isFetching}
            onClick={() => {
              void fetchNextPage();
            }}
          >
            {isFetching ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </>
  );
}
