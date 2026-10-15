import { formatCompactUsd, formatSignedPercent } from "@/core/utils/formatters";
import { TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

/** Directional label, shows "Close Short/Long" when reduceOnly. */
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

export function PosDirLabel({ szi }: { szi: string }) {
  const n = Number(szi);
  return <span className={n >= 0 ? "text-gain" : "text-loss"}>{n >= 0 ? "Long" : "Short"}</span>;
}

/** Direction label from HL API `dir` field ("Open Long", "Close Short", etc.). */
export function DirDisplay({ dir }: { dir?: string | null }) {
  if (!dir) return <span className="text-muted-foreground/60">—</span>;
  const isLong = dir.toLowerCase().includes("long");
  return <span className={isLong ? "text-gain" : "text-loss"}>{dir}</span>;
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
    <TabsTrigger value={value} variant="text" className="relative">
      {children}
      {count !== undefined && count > 0 && (
        <span className="text-[length:var(--text-data)] text-muted-foreground font-normal">
          ({count})
        </span>
      )}
    </TabsTrigger>
  );
}
