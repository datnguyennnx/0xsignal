// Orderbook table CSS classes — import directly by full name to aid tree-shaking.
const CELL_CLASS =
  "px-[var(--space-2,0.75rem)] py-[var(--space-1,0.3125rem)] text-[length:var(--text-compact)] whitespace-nowrap";
const CELL_NUM_CLASS =
  "px-[var(--space-2,0.75rem)] py-[var(--space-1,0.3125rem)] text-[length:var(--text-compact)] text-right tabular-nums whitespace-nowrap";
export const CELL_HEAD_CLASS =
  "h-[var(--row-h,1.875rem)] px-[var(--space-2,0.75rem)] py-[var(--space-1,0.3125rem)] text-[length:var(--text-data)] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap";
export const CELL_HEAD_NUM_CLASS =
  "h-[var(--row-h,1.875rem)] px-[var(--space-2,0.75rem)] py-[var(--space-1,0.3125rem)] text-[length:var(--text-data)] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";
export const TABLE_HEAD_CLASS = "text-xs text-muted-foreground uppercase tracking-wider";

// Short aliases for ergonomic use across table components
export const c = CELL_CLASS;
export const cNum = CELL_NUM_CLASS;
export const cHead = CELL_HEAD_CLASS;
export const cHeadNum = CELL_HEAD_NUM_CLASS;
