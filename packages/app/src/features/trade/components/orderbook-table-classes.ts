/**
 * Shared Tailwind CSS class constants for orderbook and trade tables.
 *
 * Keeps styling consistent across BalanceTable, PositionsTable,
 * OpenOrdersTable, and OrderHistoryTable — DRY source of truth.
 */
export const CELL_CLASS = "px-4 py-2 text-xs whitespace-nowrap";
export const CELL_NUM_CLASS = "px-4 py-2 text-xs text-right tabular-nums whitespace-nowrap";
export const CELL_HEAD_CLASS =
  "px-4 py-2 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap";
export const CELL_HEAD_NUM_CLASS =
  "px-4 py-2 text-[0.65rem] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";
