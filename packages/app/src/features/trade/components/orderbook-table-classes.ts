/**
 * Shared Tailwind CSS class constants for orderbook and trade tables.
 *
 * Typography aligned to DESIGN.md scale:
 *   Cell body  → text-[length:var(--text-compact)]  = clamp(13px, 0.2vw, 14px)  weight 500
 *   Cell head  → text-[length:var(--text-data)]     = clamp(12px, 0.2vw, 14px)  weight 500
 *
 * Nothing falls below 12px (DESIGN.md Data minimum).
 */
export const CELL_CLASS = "px-4 py-3 text-[length:var(--text-compact)] whitespace-nowrap";

export const CELL_NUM_CLASS =
  "px-4 py-3 text-[length:var(--text-compact)] text-right tabular-nums whitespace-nowrap";

export const CELL_HEAD_CLASS =
  "px-4 py-2.5 text-[length:var(--text-data)] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap";

export const CELL_HEAD_NUM_CLASS =
  "px-4 py-2.5 text-[length:var(--text-data)] font-medium text-muted-foreground uppercase tracking-wider text-right whitespace-nowrap";
