/**
 * @overview Shared table utility components and formatting helpers
 * extracted from position-management.tsx for reuse across trade tables.
 *
 * Includes skeleton loading states, direction/side labels, PnL display,
 * time/status/number formatting, and a custom tab trigger with count badge.
 */

import { formatCompactUsd, formatSignedPercent } from "@/core/utils/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

/* ─── Component helpers ─── */

/**
 * Table skeleton for loading states. Renders a placeholder table
 * with the specified number of rows and columns.
 */
export function TableSkeleton({ rows = 3, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <Table>
      <TableBody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: cols }).map((_, j) => (
              <TableCell key={j} className="py-1">
                <Skeleton className="h-3 w-20" />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Renders a Long/Short label with gain/loss color based on the
 * Hyperliquid side encoding ("A" = Sell/Short, "B" = Buy/Long).
 */
export function SideLabel({ side }: { side: "A" | "B" }) {
  return (
    <span className={side === "B" ? "text-gain" : "text-loss"}>
      {side === "B" ? "Long" : "Short"}
    </span>
  );
}

/**
 * Renders a directional label accounting for reduce-only orders.
 * Shows "Close Short" / "Close Long" when reduceOnly is true.
 */
export function DirLabel({ side, reduceOnly }: { side: "A" | "B"; reduceOnly?: boolean }) {
  if (reduceOnly) {
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

/**
 * Renders a position direction label (Long/Short) based on
 * the sign of the position size string.
 */
export function PosDirLabel({ szi }: { szi: string }) {
  const n = Number(szi);
  return <span className={n >= 0 ? "text-gain" : "text-loss"}>{n >= 0 ? "Long" : "Short"}</span>;
}

/**
 * Renders a formatted PnL value with both USD amount and ROE percentage.
 * Positive values are rendered in gain color, negative in loss color.
 */
export function PnLDisplay({ usd, pct }: { usd: number; pct: number }) {
  const isPositive = usd >= 0;
  return (
    <span className={isPositive ? "text-gain" : "text-loss"}>
      {formatCompactUsd(Math.abs(usd))} ({formatSignedPercent(pct)})
    </span>
  );
}

/* ─── Pure formatting helpers ─── */

/**
 * Format a Unix timestamp (ms) to a human-readable date-time string.
 *
 * @example
 * formatTime(1700000000000) // → "11/15/2023 - 05:33:20"
 */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yyyy = d.getFullYear();
  const hh = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  const ss = d.getSeconds().toString().padStart(2, "0");
  return `${mm}/${dd}/${yyyy} - ${hh}:${min}:${ss}`;
}

/**
 * Convert an order status string to a human-readable label.
 * Handles common variants including "*Canceled" patterns.
 *
 * @example
 * formatStatus("open")                   // → "Open"
 * formatStatus("filled")                 // → "Filled"
 * formatStatus("triggered")              // → "Triggered"
 * formatStatus("canceled")               // → "Canceled"
 * formatStatus("IoCanceled")             // → "Canceled"
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "filled":
      return "Filled";
    case "triggered":
      return "Triggered";
    default:
      // Map all *Canceled variants → "Canceled"
      if (status.toLowerCase().includes("cancel")) return "Canceled";
      // Capitalize first letter for anything else
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Compact number formatting: millions (M), thousands (K),
 * or raw with decreasing precision for small values.
 *
 * @example
 * fmtNum(1_500_000) // → "1.50M"
 * fmtNum(2_500)     // → "2.50K"
 * fmtNum(100)       // → "100.00"
 * fmtNum(0.05)      // → "0.0500"
 * fmtNum(0.000123)  // → "0.000123"
 */
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(4);
  return n.toFixed(6);
}

/* ─── Flat tab trigger ─── */

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
  count?: number;
  children: ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative flex-none px-3 py-1.5 text-xs font-medium
        bg-transparent dark:bg-transparent border-0 rounded-none shadow-none
        data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent
        data-[state=active]:shadow-none
        text-muted-foreground hover:text-foreground/80
        data-[state=active]:text-foreground dark:data-[state=active]:text-foreground
        data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0
        data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-foreground
        transition-colors cursor-pointer"
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="text-xs text-muted-foreground font-normal">({count})</span>
      )}
    </TabsTrigger>
  );
}
