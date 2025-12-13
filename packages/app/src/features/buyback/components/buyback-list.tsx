import { useState, useMemo } from "react";
import type { BuybackSignal, BuybackStrength } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatCompact } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown } from "lucide-react";

interface BuybackListProps {
  readonly signals: readonly BuybackSignal[];
  readonly onSelect?: (signal: BuybackSignal) => void;
}

type SortKey = "annualizedBuybackRate" | "revenue24h" | "marketCap" | "revenueGrowth7d";

const STRENGTH_STYLES: Record<BuybackStrength, string> = {
  NONE: "text-muted-foreground",
  LOW: "text-muted-foreground",
  MODERATE: "text-foreground",
  HIGH: "text-gain",
  VERY_HIGH: "text-gain font-semibold",
};

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "annualizedBuybackRate", label: "Yield" },
  { key: "revenue24h", label: "Revenue" },
  { key: "marketCap", label: "MCap" },
  { key: "revenueGrowth7d", label: "Growth" },
];

function ProtocolCard({
  signal,
  onSelect,
}: {
  signal: BuybackSignal;
  onSelect?: (signal: BuybackSignal) => void;
}) {
  const growth = signal.revenueGrowth7d ?? 0;
  const yieldRate = signal.annualizedBuybackRate;
  const change30d = signal.change30d;

  return (
    <div
      onClick={() => onSelect?.(signal)}
      className="group relative flex flex-col gap-4 p-5 rounded-2xl border border-border/40 bg-card hover:border-border/80 hover:bg-muted/30 transition-all duration-300 ease-premium cursor-pointer select-none"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <CryptoIcon
            symbol={signal.symbol}
            image={signal.logo ?? undefined}
            size={40}
            className="shrink-0 rounded-full bg-secondary/20 p-0.5"
          />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-base sm:text-lg tracking-tight font-mono leading-none">
              {signal.symbol.toUpperCase()}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-widest opacity-70">
                {signal.category}
              </span>
              {change30d !== null && change30d !== 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[9px] font-mono",
                    change30d > 0 ? "text-gain" : "text-loss"
                  )}
                >
                  {change30d > 0 ? (
                    <TrendingUp className="h-2.5 w-2.5" />
                  ) : (
                    <TrendingDown className="h-2.5 w-2.5" />
                  )}
                  {Math.abs(change30d).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-right flex flex-col items-end gap-0.5">
          <div
            className={cn(
              "text-lg sm:text-xl font-bold tabular-nums tracking-tight font-mono leading-none",
              STRENGTH_STYLES[signal.signal]
            )}
          >
            {yieldRate.toFixed(1)}%
          </div>
          <div className="text-[9px] sm:text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">
            Yield
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-2">
        <div className="flex flex-col gap-1">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider opacity-60">
            Rev 24h
          </span>
          <span className="text-sm sm:text-base font-medium tabular-nums font-mono">
            {formatCompact(signal.revenue24h)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider opacity-60">
            MCap
          </span>
          <span className="text-sm sm:text-base font-medium tabular-nums font-mono">
            {formatCompact(signal.marketCap)}
          </span>
        </div>
        <div className="flex flex-col gap-1 items-end">
          <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider opacity-60">
            7d Growth
          </span>
          <span
            className={cn(
              "text-sm sm:text-base font-medium tabular-nums font-mono",
              growth > 0 ? "text-gain" : growth < 0 ? "text-loss" : "text-muted-foreground"
            )}
          >
            {growth > 0 ? "+" : ""}
            {growth.toFixed(0)}%
          </span>
        </div>
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

  const sorted = useMemo(() => {
    return [...signals].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [signals, sortKey, sortDesc]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap pb-2">
        <span className="text-xs font-mono text-muted-foreground mr-2">SORT BY:</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <Button
            key={key}
            variant={sortKey === key ? "secondary" : "outline"}
            size="sm"
            onClick={() => handleSort(key)}
            className={cn(
              "h-7 text-[10px] font-mono uppercase tracking-wider gap-1",
              sortKey === key
                ? "border-transparent"
                : "border-border/40 bg-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {sortKey === key &&
              (sortDesc ? (
                <ChevronDown className="w-3 h-3 opacity-50" />
              ) : (
                <ChevronUp className="w-3 h-3 opacity-50" />
              ))}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {sorted.map((signal) => (
          <ProtocolCard key={signal.protocol} signal={signal} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
