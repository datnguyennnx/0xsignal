/**
 * @overview Shared table UI components extracted from shared-table-utils.tsx
 * for reuse across trade tables.
 */

import { formatCompactUsd, formatSignedPercent } from "@/core/utils/formatters";
import { TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

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
 */
export function PnLDisplay({ usd, pct }: { usd: number; pct: number }) {
  const isPositive = usd >= 0;
  return (
    <span className={isPositive ? "text-gain" : "text-loss"}>
      {formatCompactUsd(Math.abs(usd))} ({formatSignedPercent(pct)})
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
  count?: number;
  children: ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="relative flex-none px-3 py-2 text-[length:var(--text-compact)] font-medium
        bg-transparent dark:bg-transparent border-0 rounded-none shadow-none
        data-[state=active]:bg-transparent dark:data-[state=active]:bg-transparent
        data-[state=active]:shadow-none
        text-muted-foreground hover:text-foreground/80
        data-[state=active]:text-foreground dark:data-[state=active]:text-foreground
        data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-0
        data-[state=active]:after:right-0 data-[state=active]:after:h-[2px] data-[state=active]:after:bg-foreground
        transition-colors cursor-pointer gap-[clamp(0.375rem,0.6vw,0.625rem)]"
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className="text-[length:var(--text-data)] text-muted-foreground font-normal">
          ({count})
        </span>
      )}
    </TabsTrigger>
  );
}
