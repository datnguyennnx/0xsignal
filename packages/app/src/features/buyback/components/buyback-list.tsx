/**
 * Buyback List - Card-based vertical layout
 * Better UX with stacked information instead of horizontal columns
 */

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

const strengthStyles: Record<BuybackStrength, string> = {
  NONE: "text-muted-foreground",
  LOW: "text-muted-foreground",
  MODERATE: "text-foreground",
  HIGH: "text-gain",
  VERY_HIGH: "text-gain font-semibold",
};

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
      className="py-0 shadow-none cursor-pointer transition-all hover:shadow-sm active:scale-[0.995]"
      onClick={() => onSelect?.(signal)}
    >
      <CardContent className="p-4">
        {/* Row 1: Symbol + Category */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <CryptoIcon symbol={signal.symbol} size={24} className="shrink-0" />
            <div>
              <div className="font-medium text-sm">{signal.symbol.toUpperCase()}</div>
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 mt-0.5">
                {signal.category}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div
              className={cn("text-lg font-semibold tabular-nums", strengthStyles[signal.signal])}
            >
              {yieldRate.toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground">Yield</div>
          </div>
        </div>

        {/* Row 2: Metrics */}
        <div className="flex items-center justify-between pt-3 border-t border-border/50 text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">Rev </span>
              <span className="tabular-nums">{formatCurrency(signal.revenue24h)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">MCap </span>
              <span className="tabular-nums text-muted-foreground">
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

  // useMemo kept - sorting large arrays is expensive
  const sorted = useMemo(() => {
    return [...signals].sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortDesc ? bVal - aVal : aVal - bVal;
    });
  }, [signals, sortKey, sortDesc]);

  return (
    <div className="space-y-4">
      {/* Sort controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Sort:</span>
        {[
          { key: "annualizedBuybackRate" as SortKey, label: "Yield" },
          { key: "revenue24h" as SortKey, label: "Revenue" },
          { key: "marketCap" as SortKey, label: "MCap" },
          { key: "revenueGrowth7d" as SortKey, label: "Growth" },
        ].map(({ key, label }) => (
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

      {/* Protocol cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sorted.map((signal) => (
          <ProtocolCard key={signal.protocol} signal={signal} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
