import type { TreasuryEntity } from "@0xsignal/shared";

import { PieChart } from "./pie-chart";
import { formatCompact } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface EntityDetailPanelProps {
  entity: TreasuryEntity | null;
  onClose: () => void;
}

export function EntityDetailPanel({ entity, onClose }: EntityDetailPanelProps) {
  if (!entity) return null;

  const hasKnownEntry = entity.entryValueUsd > 0;

  return (
    <aside className="w-full h-[100dvh] lg:h-full flex flex-col bg-background lg:bg-transparent overflow-hidden overscroll-contain lg:border-l lg:border-border/10">
      {/* Header */}
      <div className="shrink-0 pt-6 px-6 pb-2 flex items-start justify-between bg-transparent">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight font-mono">
              {entity.entityName}
            </h2>
            <span className="text-xs font-mono text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">
              {entity.symbol}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground opacity-60">
            <span>{entity.country}</span>
            <span>•</span>
            <span>{entity.holdings.length} Assets</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 -mr-2 text-muted-foreground/50 hover:text-foreground"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-24 lg:pb-8 space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-widest opacity-70">
              Total Value
            </span>
            <span className="text-2xl sm:text-3xl font-bold tabular-nums font-mono leading-none tracking-tight">
              ${formatCompact(entity.totalValueUsd)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-widest opacity-70">
              Unrealized P&L
            </span>
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-2xl sm:text-3xl font-bold tabular-nums font-mono leading-none tracking-tight",
                  !hasKnownEntry
                    ? "text-muted-foreground"
                    : entity.unrealizedPnlPercent >= 0
                      ? "text-gain"
                      : "text-loss"
                )}
              >
                {hasKnownEntry
                  ? `${entity.unrealizedPnlPercent >= 0 ? "+" : ""}${entity.unrealizedPnlPercent.toFixed(1)}%`
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        {/* Portfolio Breakdown - Only show pie chart for multiple holdings */}
        {entity.holdings.length > 1 && (
          <div className="space-y-3">
            <span className="text-[10px] sm:text-xs font-mono text-muted-foreground uppercase tracking-widest opacity-50 px-1">
              Portfolio Allocation
            </span>
            <div className="-ml-2 -mr-2">
              <PieChart holdings={entity.holdings} />
            </div>
          </div>
        )}

        {/* Holdings List - Clean table-like */}
        <div className="space-y-4 pt-4 border-t border-border/10">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-50 px-1">
            Top Assets
          </span>
          <div className="space-y-1">
            {entity.holdings.map((holding, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 px-1 hover:bg-muted/30 transition-colors rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">
                    <Badge
                      variant="outline"
                      className="font-mono text-xs h-5 px-1.5 border-border/40 bg-transparent text-muted-foreground"
                    >
                      {holding.coinSymbol}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums font-mono opacity-60">
                    {holding.percentOfSupply.toFixed(4)}% supply
                  </span>
                </div>
                <div className="text-right flex flex-col items-end gap-0.5">
                  <div className="text-base font-bold tabular-nums font-mono tracking-tight">
                    {formatCompact(holding.holdings)}
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums font-mono opacity-50">
                    ${formatCompact(holding.valueUsd)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
