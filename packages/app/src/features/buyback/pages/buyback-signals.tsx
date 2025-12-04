/**
 * Buyback Signals Page - Card-based layout
 */

import { useState } from "react";
import type { BuybackOverview, BuybackSignal } from "@0xsignal/shared";
import { cachedBuybackOverview } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { BuybackStats } from "@/features/buyback/components/buyback-stats";
import { BuybackList } from "@/features/buyback/components/buyback-list";
import { CategoryBreakdown } from "@/features/buyback/components/category-breakdown";
import { ProtocolDetailDialog } from "@/features/buyback/components/protocol-detail-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";

const fetchBuybackData = () => cachedBuybackOverview();

function BuybackContent({ overview }: { overview: BuybackOverview }) {
  const signals = overview.topBuybackProtocols;
  const [selectedSignal, setSelectedSignal] = useState<BuybackSignal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectProtocol = (signal: BuybackSignal) => {
    setSelectedSignal(signal);
    setDialogOpen(true);
  };

  return (
    <div className="container-fluid py-4 sm:py-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <header className="mb-4 sm:mb-5">
        <h1 className="text-base sm:text-lg lg:text-xl font-semibold tracking-tight">
          Protocol Buybacks
        </h1>
        <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
          Revenue yield relative to market cap · Higher yield = stronger buyback potential
        </p>
      </header>

      {/* Stats Grid */}
      <BuybackStats overview={overview} />

      {/* Main Content - Sidebar below on mobile, side on desktop */}
      <div className="flex flex-col-reverse lg:flex-row gap-5 lg:gap-6">
        {/* Protocol Grid */}
        <section className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between mb-4 border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                Protocols
              </h2>
              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-sm tabular-nums">
                {signals.length}
              </span>
            </div>
          </div>
          {signals.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-border/60 rounded-sm">
              <p className="text-xs text-muted-foreground font-mono">NO PROTOCOLS FOUND</p>
            </div>
          ) : (
            <BuybackList signals={signals} onSelect={handleSelectProtocol} />
          )}
        </section>

        {/* Sidebar - At bottom on mobile */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <CategoryBreakdown categories={overview.byCategory} />

          {/* Metrics Legend */}
          <Card className="hidden sm:block py-0 shadow-none">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-xs">Metrics</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0">
              <dl className="text-[10px] text-muted-foreground space-y-1.5">
                <div>
                  <dt className="inline font-medium text-foreground">Yield</dt>
                  <dd className="inline"> = (30d Rev × 12) / MCap</dd>
                </div>
                <div>
                  <dt className="inline font-medium text-foreground">P/Rev</dt>
                  <dd className="inline"> = MCap / Annual Rev</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>

      <ProtocolDetailDialog
        signal={selectedSignal}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

// Loading skeleton
function BuybackSkeleton() {
  return (
    <div className="container-fluid py-4 sm:py-6 space-y-6">
      <div>
        <Skeleton className="h-6 w-40 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <Skeleton className="h-5 w-20 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="w-full lg:w-64">
          <Skeleton className="h-48 rounded-xl" />
        </div>
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
        <h1 className="text-lg font-semibold mb-4">Protocol Buybacks</h1>
        <ErrorState
          title="Unable to load buyback data"
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return <BuybackContent overview={data} />;
}
