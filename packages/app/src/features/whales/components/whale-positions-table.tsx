import { memo, useEffect, useMemo, useRef, useState, type JSX } from "react";
import { cn } from "cn";

import { useOpenCoin } from "@/components/app-side-panel-context";
import { Region } from "@/components/region";
import { preloadRoute } from "@/lib/preload-routes";
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
import { useHyperliquidMeta } from "@/features/trade/hooks/use-hyperliquid-meta";
import {
  formatCompactUsd,
  formatPrice,
  formatSignedPercent,
  formatSignedUsd,
  formatSize,
} from "@/core/utils/formatters";

import {
  normalizeWhaleSymbol,
  resolveWhaleSymbol,
  useWhalePositionsState,
  whalePositionRowKey,
} from "../hooks/use-whale-positions";
import { WhalePositionFiltersBar } from "./whale-position-filters";
import { DEFAULT_WHALE_FILTERS, type WhalePositionFilters } from "./whale-filter-defaults";
import {
  areWhaleRowPropsEqual,
  formatEntryTime,
  type WhalePositionRowProps,
} from "./whale-positions-table-format";

const CELL_CLASS = "px-3";

const SYMBOL_DEBOUNCE_MS = 250;

/** The query trails the input by one pause, so typing never fires a request per keystroke. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
    };
  }, [value, delayMs]);
  return debounced;
}

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
  { id: "rank", label: "#", role: "num", bar: "w-4", lines: 1 },
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

function toneClass(value: number): string {
  return value >= 0 ? "text-gain" : "text-loss";
}

interface WhalePositionsTableProps {
  onSelectWallet: (address: string) => void;
}

function TableColumnHeaders() {
  return (
    <TableHeader className="[&_th]:h-9 [&_th]:bg-(--plate-fill)">
      <TableRow>
        {COLUMNS.map((column) => (
          <TableHead
            key={column.id}
            className={cn(
              ROLE_CLASS[column.role],
              "px-3 py-0 text-pretty",
              column.role === "num" && "whitespace-nowrap",
            )}
          >
            {column.label}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function WhalePositionsSkeleton() {
  return (
    <Table aria-hidden="true" className="table-cull">
      <TableColumnHeaders />
      <TableBody>
        {SKELETON_ROW_KEYS.map((rowKey) => (
          <TableRow key={rowKey} className="h-12 hover:bg-transparent">
            {COLUMNS.map((column) => (
              <TableCell key={column.id} className={cn(CELL_CLASS, ROLE_CLASS[column.role])}>
                <Skeleton className={cn("h-[1.35em] type-data", column.bar)} />
                {column.lines === 2 && <Skeleton className="mt-1 h-[1.2em] w-1/2 type-label" />}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
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
      className="h-12 cursor-pointer focus-ring-inset"
    >
      <TableCell className={cn(CELL_CLASS, "col-num text-muted-foreground")}>{index + 1}</TableCell>
      <TableCell className={cn(CELL_CLASS, "col-addr font-mono")}>
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
      <TableCell className={cn(CELL_CLASS, "col-text font-medium")}>
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
      <TableCell className={cn(CELL_CLASS, "col-text")}>
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
        {formatPrice(Number(position.entryPx))}
      </TableCell>
      <TableCell className={cn(CELL_CLASS, "col-num")}>
        {position.liquidationPx === undefined || position.liquidationPx === ""
          ? "—"
          : formatPrice(Number(position.liquidationPx))}
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
          : formatPrice(Number(position.markPrice))}
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
  const [symbolSubmitted, setSymbolSubmitted] = useState(false);
  const debouncedSymbol = useDebouncedValue(symbolInput, SYMBOL_DEBOUNCE_MS);
  const { meta } = useHyperliquidMeta();
  const openCoin = useOpenCoin();

  const knownSymbols = useMemo(() => {
    const symbols = new Set<string>();
    for (const market of meta ?? []) {
      if (market.coin !== "") symbols.add(market.coin);
      if (market.rawCoin !== "") symbols.add(market.rawCoin);
    }
    return [...symbols].toSorted((a, b) => a.localeCompare(b));
  }, [meta]);

  const knownSymbolSet = useMemo(
    () => new Set(knownSymbols.map((symbol) => normalizeWhaleSymbol(symbol))),
    [knownSymbols],
  );
  const typedSymbol = normalizeWhaleSymbol(symbolInput);
  const symbolUnknown =
    typedSymbol !== "" && knownSymbols.length > 0 && !knownSymbolSet.has(typedSymbol);

  // An unknown value issues no query until the user submits it; then the server decides.
  const querySymbol =
    normalizeWhaleSymbol(debouncedSymbol) === "" || (symbolUnknown && !symbolSubmitted)
      ? undefined
      : resolveWhaleSymbol(debouncedSymbol, knownSymbols);

  const query = useMemo(
    () => ({
      symbol: querySymbol === "" ? undefined : querySymbol,
      side: filters.side === "all" ? undefined : filters.side,
      sort: filters.sort,
    }),
    [querySymbol, filters.side, filters.sort],
  );

  const hasActiveFilters = query.symbol !== undefined || filters.side !== "all";
  const { state, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useWhalePositionsState(
    query,
    hasActiveFilters,
  );
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (sentinel === null || state.status !== "ready") return () => {};

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (!hasNextPage || isFetchingNextPage) return;
        void fetchNextPage();
      },
      { root: sentinel.parentElement, rootMargin: "200px 0px" },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [state.status, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const empty = hasActiveFilters
    ? {
        title: "No matching positions",
        description: "No positions match the current filters.",
        action: (
          <Button
            variant="outline"
            onClick={() => {
              setFilters(DEFAULT_WHALE_FILTERS);
              setSymbolInput(DEFAULT_WHALE_FILTERS.symbol);
            }}
          >
            Clear filters
          </Button>
        ),
      }
    : {
        title: "No whale positions",
        description: "Positions will appear here once whale activity is detected.",
      };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <WhalePositionFiltersBar
        filters={filters}
        onChange={(patch) => {
          setFilters((prev) => ({ ...prev, ...patch }));
        }}
        symbolInput={symbolInput}
        onSymbolChange={(value) => {
          setSymbolInput(value);
          setSymbolSubmitted(false);
        }}
        onSymbolSubmit={() => {
          setSymbolSubmitted(true);
        }}
        knownSymbols={knownSymbols}
        symbolUnknown={symbolUnknown}
      />

      <Region
        state={state}
        label="Whale positions"
        className="mt-4 flex min-h-0 flex-1 flex-col"
        skeleton={<WhalePositionsSkeleton />}
        empty={empty}
        error={{
          title: "Unable to load whale positions",
          retry: () => {
            void refetch();
          },
        }}
      >
        {(rows) => (
          <Table
            aria-label="Whale positions"
            className="table-cull"
            footer={<div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}
          >
            <TableColumnHeaders />
            <TableBody>
              {rows.map((position, index) => (
                <WhalePositionRow
                  key={whalePositionRowKey(position)}
                  position={position}
                  index={index}
                  onSelectWallet={onSelectWallet}
                  onOpenCoin={openCoin}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Region>

      <span aria-live="polite" className="sr-only">
        {isFetchingNextPage
          ? "Loading more…"
          : state.status === "ready" && !hasNextPage
            ? "All positions loaded"
            : ""}
      </span>
    </div>
  );
}
