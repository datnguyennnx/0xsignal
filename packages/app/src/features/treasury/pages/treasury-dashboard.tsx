import { useState } from "react";
import type { TreasuryEntity, CoinHolding } from "@0xsignal/shared";
import { cachedTreasuryEntities } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { formatCompact } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { EntityDetailPanel } from "@/features/treasury/components/entity-detail-sheet";
import { DataAgeBadge } from "@/components/data-freshness";

const fetchTreasuryData = () => cachedTreasuryEntities();

/** Entity card */
function EntityCard({ entity, onClick }: { entity: TreasuryEntity; onClick: () => void }) {
  const hasKnownEntry = entity.entryValueUsd > 0;
  const primaryHolding = entity.holdings[0];

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col gap-4 p-5 rounded-2xl border border-border/40 bg-card hover:border-border/80 hover:bg-muted/30 transition-all duration-300 ease-premium cursor-pointer select-none"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="font-mono font-bold text-base truncate group-hover:text-foreground">
            {entity.entityName}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-70">
              {entity.symbol}
            </span>
            <span className="text-[10px] text-muted-foreground opacity-50">•</span>
            <span className="text-[10px] text-muted-foreground opacity-70">{entity.country}</span>
          </div>
        </div>
        {/* P&L indicator - minimal */}
        <div
          className={cn(
            "text-[10px] font-mono font-bold tabular-nums px-1.5 py-0.5 rounded tracking-tight",
            !hasKnownEntry
              ? "text-muted-foreground bg-secondary/50"
              : entity.unrealizedPnlPercent >= 0
                ? "text-gain bg-gain/10"
                : "text-loss bg-loss/10"
          )}
        >
          {hasKnownEntry
            ? `${entity.unrealizedPnlPercent >= 0 ? "+" : ""}${entity.unrealizedPnlPercent.toFixed(1)}%`
            : "N/A"}
        </div>
      </div>

      {/* Holdings summary - No Separator */}
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-1.5 flex-wrap max-w-[60%]">
          {entity.holdings.slice(0, 3).map((h, idx) => (
            <span
              key={idx}
              className="text-[9px] font-mono bg-secondary/30 border border-border/20 px-1.5 py-0.5 rounded text-muted-foreground"
            >
              {h.coinSymbol}
            </span>
          ))}
          {entity.holdings.length > 3 && (
            <span className="text-[9px] text-muted-foreground font-mono opacity-60">
              +{entity.holdings.length - 3}
            </span>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums font-mono leading-none">
            ${formatCompact(entity.totalValueUsd)}
          </div>
          {primaryHolding && (
            <div className="text-[10px] text-muted-foreground tabular-nums opacity-60 mt-0.5">
              {formatCompact(primaryHolding.holdings)} {primaryHolding.coinSymbol}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Stats bar */
function StatsBar({ totalValue, entityCount }: { totalValue: number; entityCount: number }) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-mono text-[10px] sm:text-xs uppercase tracking-wide">
          TOTAL VALUE
        </span>
        <span className="font-semibold tabular-nums font-mono border-b border-dashed border-muted-foreground/30">
          ${formatCompact(totalValue)}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-mono text-[10px] sm:text-xs uppercase tracking-wide">
          ENTITIES
        </span>
        <span className="font-semibold tabular-nums font-mono border-b border-dashed border-muted-foreground/30">
          {entityCount}
        </span>
      </div>
    </div>
  );
}

/** Main content */
function TreasuryContent({
  entities,
  totalValueUsd,
  entityCount,
  fetchedAt,
}: {
  entities: readonly TreasuryEntity[];
  totalValueUsd: number;
  entityCount: number;
  fetchedAt?: Date;
}) {
  const [selectedEntity, setSelectedEntity] = useState<TreasuryEntity | null>(null);

  const handleSelectEntity = (entity: TreasuryEntity) => {
    setSelectedEntity(entity);
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
                    Institutional Treasury
                  </h1>
                  <DataAgeBadge timestamp={fetchedAt} thresholds={{ fresh: 30, stale: 120 }} />
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 max-w-md leading-relaxed">
                  Public companies and ETFs holding crypto assets. Analyze institutional adoption
                  and holdings.
                </p>
              </div>
              <StatsBar totalValue={totalValueUsd} entityCount={entityCount} />
            </header>

            {/* Entity Cards Grid */}
            <section>
              <div className="flex items-center justify-between mb-4 pb-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs sm:text-sm font-mono font-medium text-muted-foreground uppercase tracking-widest">
                    Top Holdings
                  </h2>
                  <span className="text-[10px] sm:text-xs bg-secondary/50 px-2 py-0.5 rounded-full tabular-nums border border-border/40">
                    {entities.length}
                  </span>
                </div>
                <span className="hidden sm:block text-[10px] sm:text-xs text-muted-foreground font-mono opacity-80">
                  TAP CARD FOR PORTFOLIO BREAKDOWN
                </span>
              </div>

              {entities.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-border/40 rounded-xl bg-muted/10">
                  <p className="text-sm text-muted-foreground font-mono">
                    NO TREASURY DATA AVAILABLE
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                  {entities.slice(0, 20).map((entity, idx) => (
                    <EntityCard
                      key={entity.symbol || idx}
                      entity={entity}
                      onClick={() => handleSelectEntity(entity)}
                    />
                  ))}
                </div>
              )}

              {entities.length > 20 && (
                <div className="mt-8 text-center text-[10px] text-muted-foreground font-mono border-t border-border/40 pt-4 w-full">
                  Showing top 20 of {entities.length} entities
                </div>
              )}
            </section>

            {/* Methodology Note */}
            <footer className="mt-6 pt-4 border-t border-border/20">
              <p className="text-[10px] text-muted-foreground font-mono leading-relaxed opacity-70">
                Data sourced from CoinGecko Public Treasury API. P&L = (Current Value - Entry Cost)
                / Entry Cost. N/A indicates unknown cost basis.
              </p>
            </footer>
          </div>
        </div>

        {/* Right Column: Detail Panel (App Pane) */}
        {selectedEntity && (
          <aside className="w-full lg:w-[500px] shrink-0 fixed inset-0 z-50 h-[100dvh] lg:h-full lg:static lg:z-auto lg:block bg-background/80 backdrop-blur-sm lg:bg-transparent lg:backdrop-blur-none transition-all duration-300 ease-premium border-l border-border/10">
            <div className="h-full w-full">
              <EntityDetailPanel entity={selectedEntity} onClose={() => setSelectedEntity(null)} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

/** Loading skeleton */
function TreasurySkeleton() {
  return (
    <div className="container-fluid py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 border-b border-border/40 pb-4">
        <div>
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-8" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Treasury Dashboard Page */
export function TreasuryDashboard() {
  const { data, isLoading, isError } = useEffectQuery(fetchTreasuryData, []);

  if (isLoading) {
    return <TreasurySkeleton />;
  }

  if (isError) {
    return (
      <div className="container-fluid py-6">
        <ErrorState
          title="Unable to load treasury data"
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  if (!data || data.entityCount === 0) {
    return (
      <div className="container-fluid py-6">
        <header className="mb-6 border-b border-border/40 pb-6">
          <h1 className="text-xl sm:text-2xl font-mono font-bold tracking-tight uppercase">
            Institutional Treasury
          </h1>
          <p className="text-xs text-muted-foreground mt-1.5">
            Public companies and ETFs holding crypto assets.
          </p>
        </header>
        <div className="py-24 text-center border-2 border-dashed border-border/40 rounded-xl bg-muted/10">
          <p className="text-sm text-muted-foreground font-mono mb-2">LOADING INSTITUTIONAL DATA</p>
          <p className="text-xs text-muted-foreground/70">Refresh the page in a few seconds</p>
        </div>
      </div>
    );
  }

  return (
    <TreasuryContent
      entities={data.entities}
      totalValueUsd={data.totalValueUsd}
      entityCount={data.entityCount}
      fetchedAt={data.fetchedAt}
    />
  );
}
