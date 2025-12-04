import { useState, useMemo } from "react";
import type { BuybackSignal, BuybackStrength } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatCurrency } from "@/core/utils/formatters";
import { CryptoIcon } from "@/components/crypto-icon";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

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

  return (
    <Card
      className="py-0 shadow-none cursor-pointer transition-all hover:bg-secondary/20 active:scale-[0.995] group border-border/60"
      onClick={() => onSelect?.(signal)}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2.5">
            <CryptoIcon
              symbol={signal.symbol}
              image={signal.logo ?? undefined}
              size={24}
              className="shrink-0"
            />
            <div>
              <div className="font-bold text-sm tracking-tight">{signal.symbol.toUpperCase()}</div>
              <Badge variant="secondary" className="text-[9px] h-3.5 px-1.5 mt-0.5 font-normal">
                {signal.category}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "text-lg font-bold tabular-nums leading-none mb-0.5",
                STRENGTH_STYLES[signal.signal]
              )}
            >
              {yieldRate.toFixed(1)}%
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide opacity-70">
              Yield
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-[11px]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="uppercase tracking-wider opacity-70 text-[9px]">Rev</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatCurrency(signal.revenue24h)}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="uppercase tracking-wider opacity-70 text-[9px]">MCap</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatCurrency(signal.marketCap)}
              </span>
            </div>
          </div>
          {growth !== 0 && (
            <div className={cn("tabular-nums font-medium", growth > 0 ? "text-gain" : "text-loss")}>
              {growth > 0 ? "+" : ""}
              {growth.toFixed(0)}%
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Sort:</span>
        {SORT_OPTIONS.map(({ key, label }) => (
          <Button
            key={key}
            variant={sortKey === key ? "secondary" : "ghost"}
            size="sm"
            onClick={() => handleSort(key)}
            className="h-7 text-xs gap-1"
          >
            {label}
            {sortKey === key &&
              (sortDesc ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 gap-responsive">
        {sorted.map((signal) => (
          <ProtocolCard key={signal.protocol} signal={signal} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
