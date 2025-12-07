import { useState } from "react";
import type { BuybackOverview, BuybackSignal } from "@0xsignal/shared";
import { cachedBuybackOverview } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { BuybackList } from "@/features/buyback/components/buyback-list";
import { ProtocolDetailPanel } from "@/features/buyback/components/protocol-detail-sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { formatCurrency } from "@/core/utils/formatters";

const fetchBuybackData = () => cachedBuybackOverview();

function StatsBar({ overview }: { overview: BuybackOverview }) {
  const items = [
    { label: "24H FEES", value: formatCurrency(overview.totalRevenue24h) },
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

  const handleSelectProtocol = (signal: BuybackSignal) => {
    setSelectedSignal(signal);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-premium w-full h-full overflow-hidden">
      <div className="flex flex-col lg:flex-row items-start h-full">
        {/* Left Column: List (Scrollable) */}
        <div className="flex-1 min-w-0 w-full h-full overflow-y-auto">
          <div className="container-fluid py-4 sm:py-6 space-y-8">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 border-b border-border/40 pb-6">
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-mono font-bold tracking-tight uppercase">
                    Protocol Revenue
                  </h1>
                  <span className="text-[10px] sm:text-xs bg-secondary px-2 py-0.5 rounded-sm tabular-nums">
                    {overview.totalProtocols}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                  Fee yield relative to market cap. High yield suggests undervalued protocols or
                  strong cash flow.
                </p>
              </div>
              <StatsBar overview={overview} />
            </header>

            {/* Protocols Section */}
            <section>
              <div className="flex items-center justify-between mb-4 pb-2">
                <h2 className="text-xs sm:text-sm font-mono font-medium text-muted-foreground uppercase tracking-widest">
                  Top Protocols
                </h2>
                <span className="hidden sm:block text-[10px] sm:text-xs text-muted-foreground font-mono opacity-80">
                  YIELD = (30D FEES × 12) / MCAP
                </span>
              </div>

              {signals.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-border/40 rounded-xl bg-muted/10">
                  <p className="text-sm text-muted-foreground font-mono">NO PROTOCOLS FOUND</p>
                </div>
              ) : (
                <BuybackList signals={signals} onSelect={handleSelectProtocol} />
              )}
            </section>
          </div>
        </div>

        {/* Right Column: Detail Panel (App-like Pane on Desktop) */}
        {selectedSignal && (
          <aside className="w-full lg:w-[500px] shrink-0 fixed inset-0 z-50 h-[100dvh] lg:h-full lg:static lg:z-auto lg:block bg-background/80 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none transition-all duration-300 border-l border-border/10">
            <div className="h-full w-full">
              <ProtocolDetailPanel
                signal={selectedSignal}
                onClose={() => setSelectedSignal(null)}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// Loading skeleton - Matches dashboard skeleton
function BuybackSkeleton() {
  return (
    <div className="container-fluid py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 border-b border-border/40 pb-4">
        <div>
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-3 w-64" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-8" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
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
