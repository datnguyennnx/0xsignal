/**
 * Buyback Signals Page - Minimalist quant-focused design
 * Matches market-dashboard pattern: clean sections, high signal density
 */

import { useState } from "react";
import type { BuybackOverview, BuybackSignal } from "@0xsignal/shared";
import { cachedBuybackOverview } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { BuybackList } from "@/features/buyback/components/buyback-list";
import { ProtocolDetailDialog } from "@/features/buyback/components/protocol-detail-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { formatCurrency } from "@/core/utils/formatters";

const fetchBuybackData = () => cachedBuybackOverview();

// Compact inline stat bar - matches GlobalMarketBar pattern
function StatsBar({ overview }: { overview: BuybackOverview }) {
  const items = [
    { label: "24H REV", value: formatCurrency(overview.totalRevenue24h) },
    { label: "AVG YIELD", value: `${overview.averageBuybackRate.toFixed(1)}%` },
    { label: "PROTOCOLS", value: overview.totalProtocols.toString() },
  ];

  return (
    <div className="flex items-center gap-4 sm:gap-6 text-xs">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
            {item.label}
          </span>
          <span className="font-semibold tabular-nums">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function BuybackContent({ overview }: { overview: BuybackOverview }) {
  const signals = overview.topBuybackProtocols;
  const [selectedSignal, setSelectedSignal] = useState<BuybackSignal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectProtocol = (signal: BuybackSignal) => {
    setSelectedSignal(signal);
    setDialogOpen(true);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="container-fluid py-4 sm:py-6">
        {/* Header - Matches market-dashboard pattern */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-5 sm:mb-6 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight uppercase">
              Protocol Buybacks
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              Revenue yield relative to market cap
            </p>
          </div>
          <StatsBar overview={overview} />
        </header>

        {/* Protocols Section */}
        <section>
          <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                Top Protocols by Yield
              </h2>
              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-sm tabular-nums">
                {signals.length}
              </span>
            </div>
            {/* Inline metric legend */}
            <span className="hidden sm:block text-[9px] text-muted-foreground font-mono">
              YIELD = (30D REV × 12) / MCAP
            </span>
          </div>

          {signals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-border/60 rounded-sm">
              <p className="text-xs text-muted-foreground font-mono">NO PROTOCOLS FOUND</p>
            </div>
          ) : (
            <BuybackList signals={signals} onSelect={handleSelectProtocol} />
          )}
        </section>
      </div>

      <ProtocolDetailDialog
        signal={selectedSignal}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

// Loading skeleton - Matches dashboard skeleton
function BuybackSkeleton() {
  return (
    <div className="container-fluid py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 border-b border-border/40 pb-4">
        <div>
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-5 w-36 mb-3" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-responsive">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function BuybackSignalsPage() {
  const { data, isLoading, isError } = useEffectQuery(fetchBuybackData, []);

  if (isLoading) {
    return <BuybackSkeleton />;
  }

  if (isError || !data) {
    return (
      <div className="container-fluid py-6">
        <ErrorState
          title="Unable to load buyback data"
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return <BuybackContent overview={data} />;
}
