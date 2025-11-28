// Buyback List - useMemo kept for sorting large lists

import { useState, useMemo } from "react";
import type { BuybackSignal, BuybackStrength } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatCurrency } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";

interface BuybackListProps {
  readonly signals: readonly BuybackSignal[];
  readonly onSelect?: (signal: BuybackSignal) => void;
}

type SortKey = "annualizedBuybackRate" | "revenue24h" | "marketCap" | "revenueGrowth7d";

const strengthStyles: Record<BuybackStrength, string> = {
  NONE: "text-muted-foreground",
  LOW: "text-muted-foreground",
  MODERATE: "text-foreground",
  HIGH: "text-gain font-medium",
  VERY_HIGH: "text-gain font-semibold",
};

function SortHeader({
  label,
  sortKey,
  active,
  desc,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  active: boolean;
  desc: boolean;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => e.key === "Enter" && onSort(sortKey)}
      className={cn(
        "text-xs cursor-pointer select-none transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {label}
      {active && <span className="ml-0.5">{desc ? "↓" : "↑"}</span>}
    </div>
  );
}

function ListRow({
  signal,
  onSelect,
}: {
  signal: BuybackSignal;
  onSelect?: (signal: BuybackSignal) => void;
}) {
  const growth = signal.revenueGrowth7d ?? 0;

  return (
    <div
      role="row"
      tabIndex={0}
      onClick={() => onSelect?.(signal)}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.(signal)}
      className="flex items-center justify-between py-3 px-2 border-b border-border/30 cursor-pointer hover:bg-muted/30 transition-colors sm:grid sm:grid-cols-[1fr_5rem_5.5rem_4rem_4.5rem] sm:gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <CryptoIcon symbol={signal.symbol} size={24} />
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{signal.symbol.toUpperCase()}</div>
          <div className="text-xs text-muted-foreground truncate">{signal.category}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:hidden">
        {growth !== 0 && (
          <span className={cn("text-xs tabular-nums", growth > 0 ? "text-gain" : "text-loss")}>
            {growth > 0 ? "+" : ""}
            {growth.toFixed(0)}%
          </span>
        )}
        <span className={cn("text-sm tabular-nums", strengthStyles[signal.signal])}>
          {signal.annualizedBuybackRate.toFixed(1)}%
        </span>
      </div>

      <div className="hidden sm:block text-right tabular-nums text-sm">
        {formatCurrency(signal.revenue24h)}
      </div>
      <div className="hidden sm:block text-right tabular-nums text-sm text-muted-foreground">
        {formatCurrency(signal.marketCap)}
      </div>
      <div
        className={cn(
          "hidden sm:block text-right tabular-nums text-sm",
          growth > 0 ? "text-gain" : growth < 0 ? "text-loss" : "text-muted-foreground"
        )}
      >
        {growth !== 0 ? `${growth > 0 ? "+" : ""}${growth.toFixed(0)}%` : "—"}
      </div>
      <div
        className={cn(
          "hidden sm:block text-right tabular-nums text-sm",
          strengthStyles[signal.signal]
        )}
      >
        {signal.annualizedBuybackRate.toFixed(1)}%
      </div>
    </div>
  );
}

export function BuybackList({ signals, onSelect }: BuybackListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("annualizedBuybackRate");
  const [sortDesc, setSortDesc] = useState(true);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  // useMemo kept - sorting large arrays is expensive
  const sorted = useMemo(() => {
    return [...signals].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [signals, sortKey, sortDesc]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2 bg-muted/30 border-b border-border/50 sm:grid sm:grid-cols-[1fr_5rem_5.5rem_4rem_4.5rem] sm:gap-3">
        <span className="text-xs text-muted-foreground">Protocol</span>
        <div className="flex items-center gap-2 sm:hidden">
          <SortHeader
            label="Yield"
            sortKey="annualizedBuybackRate"
            active={sortKey === "annualizedBuybackRate"}
            desc={sortDesc}
            onSort={handleSort}
          />
        </div>
        <SortHeader
          label="Rev 24h"
          sortKey="revenue24h"
          active={sortKey === "revenue24h"}
          desc={sortDesc}
          onSort={handleSort}
          className="hidden sm:block text-right"
        />
        <SortHeader
          label="MCap"
          sortKey="marketCap"
          active={sortKey === "marketCap"}
          desc={sortDesc}
          onSort={handleSort}
          className="hidden sm:block text-right"
        />
        <SortHeader
          label="Growth"
          sortKey="revenueGrowth7d"
          active={sortKey === "revenueGrowth7d"}
          desc={sortDesc}
          onSort={handleSort}
          className="hidden sm:block text-right"
        />
        <SortHeader
          label="Yield"
          sortKey="annualizedBuybackRate"
          active={sortKey === "annualizedBuybackRate"}
          desc={sortDesc}
          onSort={handleSort}
          className="hidden sm:block text-right"
        />
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {sorted.map((signal) => (
          <ListRow key={signal.protocol} signal={signal} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
