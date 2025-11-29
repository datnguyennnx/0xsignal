// Buyback Signals Page - Mobile-first responsive design

import { useState } from "react";
import type { BuybackOverview, BuybackSignal } from "@0xsignal/shared";
import { cachedBuybackOverview } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { BuybackStats } from "@/features/buyback/components/buyback-stats";
import { BuybackList } from "@/features/buyback/components/buyback-list";
import { CategoryBreakdown } from "@/features/buyback/components/category-breakdown";
import { ProtocolDetailDialog } from "@/features/buyback/components/protocol-detail-dialog";

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
    <div className="max-w-6xl mx-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-lg sm:text-xl font-semibold">Protocol Buybacks</h1>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
          Annualized revenue yield relative to market cap · Higher yield = stronger buyback
          potential
        </p>
      </header>

      {/* Stats Grid */}
      <BuybackStats overview={overview} />

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Protocol List - Takes more space */}
        <section className="flex-1 min-w-0 lg:max-w-3xl">
          <div className="flex items-baseline justify-between mb-2 sm:mb-3">
            <h2 className="text-sm font-medium">Protocols</h2>
            <span className="text-[10px] sm:text-xs text-muted-foreground tabular-nums">
              {signals.length}
            </span>
          </div>
          {signals.length === 0 ? (
            <div className="py-12 text-center border border-dashed rounded-lg">
              <p className="text-sm text-muted-foreground">No protocols with buyback data</p>
              <p className="text-xs text-muted-foreground mt-1">
                Revenue data may be temporarily unavailable
              </p>
            </div>
          ) : (
            <BuybackList signals={signals} onSelect={handleSelectProtocol} />
          )}
        </section>

        {/* Sidebar - Fixed width on desktop */}
        <aside className="w-full lg:w-64 shrink-0 space-y-4">
          <CategoryBreakdown categories={overview.byCategory} />

          {/* Metrics Legend */}
          <div className="hidden sm:block p-3 rounded-lg border border-border/40 space-y-2">
            <h3 className="text-xs font-medium">Metrics</h3>
            <dl className="text-[10px] text-muted-foreground space-y-1">
              <div>
                <dt className="inline font-medium text-foreground">Yield</dt>
                <dd className="inline"> = (30d Rev × 12) / MCap</dd>
              </div>
              <div>
                <dt className="inline font-medium text-foreground">P/Rev</dt>
                <dd className="inline"> = MCap / Annual Rev</dd>
              </div>
            </dl>
          </div>
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

export function BuybackSignalsPage() {
  const { data, isLoading, isError } = useEffectQuery(fetchBuybackData, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-2">
          <div className="h-6 w-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading protocol revenue data</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 py-6 max-w-6xl mx-auto">
        <h1 className="text-lg font-semibold mb-4">Protocol Buybacks</h1>
        <div className="rounded-lg border border-border bg-muted/30 p-6">
          <p className="text-sm text-muted-foreground mb-4">
            Unable to fetch protocol revenue data. Check your connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <BuybackContent overview={data} />;
}
