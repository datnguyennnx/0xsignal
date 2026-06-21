// Orderbook table CSS classes — import directly by full name to aid tree-shaking.
export const CELL_CLASS = "px-4 py-3 text-[length:var(--text-compact)] whitespace-nowrap";
export const CELL_NUM_CLASS =
  "px-4 py-3 text-[length:var(--text-compact)] text-right tabular-nums whitespace-nowrap";
export const CELL_HEAD_CLASS =
  "px-4 py-2.5 text-[length:var(--text-data)] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap";
export const CELL_HEAD_NUM_CLASS =
  "px-4 py-2.5 text-[length:var(--text-data)] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";

// Short aliases for ergonomic use across table components
export const c = CELL_CLASS;
export const cNum = CELL_NUM_CLASS;
export const cHead = CELL_HEAD_CLASS;
export const cHeadNum = CELL_HEAD_NUM_CLASS;
