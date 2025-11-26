import { useState, useCallback } from "react";
import { Exit, pipe } from "effect";
import type { BuybackOverview, BuybackSignal } from "@0xsignal/shared";
import { getCachedBuybackOverview } from "@/core/api/cached-queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { BuybackStats } from "@/features/buyback/components/buyback-stats";
import { BuybackList } from "@/features/buyback/components/buyback-list";
import { CategoryBreakdown } from "@/features/buyback/components/category-breakdown";
import { ProtocolDetailDialog } from "@/features/buyback/components/protocol-detail-dialog";

const fetchBuybackData = () => getCachedBuybackOverview();

function BuybackContent({ overview }: { overview: BuybackOverview }) {
  const signals = overview.topBuybackProtocols;
  const [selectedSignal, setSelectedSignal] = useState<BuybackSignal | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectProtocol = useCallback((signal: BuybackSignal) => {
    setSelectedSignal(signal);
    setDialogOpen(true);
  }, []);

  return (
    <div className="space-y-6 px-4 py-4 sm:px-6 sm:py-6">
      {/* Header */}
      <header>
        <h1 className="text-xl font-semibold sm:text-2xl">Buyback Signals</h1>
        <p className="text-xs text-muted-foreground mt-1 sm:text-sm">
          Protocol revenue yield relative to market cap
        </p>
      </header>

      {/* Stats Grid */}
      <BuybackStats overview={overview} />

      {/* Main Content */}
      <div className="space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
        {/* Protocol List */}
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-medium">Top Protocols</h2>
            <span className="text-xs text-muted-foreground tabular-nums">{signals.length}</span>
          </div>
          {signals.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-lg">
              No signals available
            </div>
          ) : (
            <BuybackList signals={signals} onSelect={handleSelectProtocol} />
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-6">
          <CategoryBreakdown categories={overview.byCategory} />

          {/* Metrics Legend */}
          <div className="p-4 rounded-lg border border-border/40 space-y-3">
            <h3 className="text-xs font-medium">Metrics</h3>
            <dl className="text-xs text-muted-foreground space-y-1.5">
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
  const exit = useEffect_(fetchBuybackData, []);

  if (!exit) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="px-4 py-6 sm:px-6">
          <h1 className="text-xl font-semibold mb-4">Buyback Signals</h1>
          <p className="text-sm text-muted-foreground">Unable to load data</p>
        </div>
      ),
      onSuccess: (overview) => <BuybackContent overview={overview} />,
    })
  );
}
