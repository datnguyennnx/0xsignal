import { formatSignedPercent, formatSignedUsd } from "@/core/utils/formatters";
import { TabsTrigger } from "@/components/ui/tabs";
import { TableHeader, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { c, cHead, cHeadNum } from "../utils/orderbook-table-classes";
import type { ReactNode } from "react";

/** Shared fill-history column header: Time, Coin, Direction, Price, Size, Trade Value, Fee, Closed PNL. */
export function FillHistoryTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className={cHead}>Time</TableHead>
        <TableHead className={`${cHead} font-medium`}>Coin</TableHead>
        <TableHead className={cHead}>Direction</TableHead>
        <TableHead className={cHeadNum}>Price</TableHead>
        <TableHead className={cHeadNum}>Size</TableHead>
        <TableHead className={cHeadNum}>Trade Value</TableHead>
        <TableHead className={cHeadNum}>Fee</TableHead>
        <TableHead className={cHeadNum}>Closed PNL</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Same 1.5em line box as a loaded `c` cell, so a placeholder row is exactly one row tall. */
export function TableSkeletonRows({ rows, colSpan }: { rows: number; colSpan: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <TableRow key={rowIndex} className="hover:bg-transparent">
          <TableCell colSpan={colSpan} className={c}>
            <div className="flex items-center gap-4">
              {Array.from({ length: colSpan }, (_column, columnIndex) => (
                <Skeleton key={columnIndex} className="h-[1.5em] flex-1" />
              ))}
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}

/** Directional label, shows "Close Short/Long" when reduceOnly. */
export function DirLabel({
  side,
  reduceOnly,
}: {
  side: "A" | "B";
  reduceOnly?: boolean | undefined;
}) {
  if (reduceOnly === true) {
    return (
      <span className={side === "B" ? "text-gain" : "text-loss"}>
        {side === "B" ? "Close Short" : "Close Long"}
      </span>
    );
  }
  return (
    <span className={side === "B" ? "text-gain" : "text-loss"}>
      {side === "B" ? "Long" : "Short"}
    </span>
  );
}

export function PosDirLabel({ szi }: { szi: string }) {
  const n = Number(szi);
  return <span className={n >= 0 ? "text-gain" : "text-loss"}>{n >= 0 ? "Long" : "Short"}</span>;
}

/** Direction label from HL API `dir` field ("Open Long", "Close Short", etc.). */
export function DirDisplay({ dir }: { dir?: string | null | undefined }) {
  if (dir === undefined || dir === null || dir === "")
    return <span className="text-muted-foreground">—</span>;
  const isLong = dir.toLowerCase().includes("long");
  return <span className={isLong ? "text-gain" : "text-loss"}>{dir}</span>;
}

/**
 * Renders a formatted PnL value with both USD amount and ROE percentage.
 */
export function PnLDisplay({ usd, pct }: { usd: number; pct: number }) {
  const isPositive = usd >= 0;
  return (
    <span className={`${isPositive ? "text-gain" : "text-loss"} tabular-nums`}>
      {formatSignedUsd(usd)} ({formatSignedPercent(pct)})
    </span>
  );
}

/**
 * A custom TabsTrigger styled as a flat text label with an active
 * underline indicator. Optionally displays a count badge.
 */
export function TabTrigger({
  value,
  count,
  children,
}: {
  value: string;
  count?: number | undefined;
  children: ReactNode;
}) {
  return (
    <TabsTrigger value={value} variant="text" className="relative">
      {children}
      {count !== undefined && count > 0 && (
        <span className="type-data text-muted-foreground font-normal tabular-nums">({count})</span>
      )}
    </TabsTrigger>
  );
}
