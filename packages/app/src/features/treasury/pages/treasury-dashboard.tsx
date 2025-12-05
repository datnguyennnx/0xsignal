import { useState } from "react";
import type { TreasuryEntity, CoinHolding } from "@0xsignal/shared";
import { cachedTreasuryEntities } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { formatCompact } from "@/core/utils/formatters";
import { cn } from "@/core/utils/cn";
import { X } from "lucide-react";

const fetchTreasuryData = () => cachedTreasuryEntities();

/** Pie chart colors - monochrome with one accent */
const CHART_COLORS = [
  "oklch(0.45 0 0)", // BTC - Dark gray
  "oklch(0.65 0 0)", // ETH - Medium gray
  "oklch(0.80 0 0)", // Others - Light gray
];

/** Simple pie chart component */
function PieChart({ holdings }: { holdings: readonly CoinHolding[] }) {
  const total = holdings.reduce((acc, h) => acc + h.valueUsd, 0);
  if (total === 0) return null;

  let currentAngle = 0;
  const segments = holdings.map((holding, idx) => {
    const percentage = (holding.valueUsd / total) * 100;
    const angle = (percentage / 100) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;

    // Calculate arc path
    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((startAngle + angle - 90) * Math.PI) / 180;

    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const d =
      angle >= 359.99
        ? `M 50 10 A 40 40 0 1 1 49.99 10 Z`
        : `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      path: d,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      holding,
      percentage,
    };
  });

  return (
    <div className="flex items-center gap-4">
      {/* Pie Chart SVG */}
      <svg viewBox="0 0 100 100" className="w-24 h-24 sm:w-32 sm:h-32">
        {segments.map((seg, idx) => (
          <path
            key={idx}
            d={seg.path}
            fill={seg.color}
            className="transition-opacity hover:opacity-80"
          />
        ))}
        {/* Center circle for donut effect */}
        <circle cx="50" cy="50" r="20" className="fill-background" />
      </svg>

      {/* Legend */}
      <div className="flex flex-col gap-1.5">
        {segments.map((seg, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="font-mono font-medium">{seg.holding.coinSymbol}</span>
            <span className="text-muted-foreground tabular-nums">{seg.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Entity detail modal */
function EntityDetailModal({ entity, onClose }: { entity: TreasuryEntity; onClose: () => void }) {
  const hasKnownEntry = entity.entryValueUsd > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-lg shadow-lg max-w-md w-full max-h-[80vh] overflow-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-border/40">
          <div>
            <h2 className="text-base font-mono font-bold">{entity.entityName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-mono text-muted-foreground">{entity.symbol}</span>
              <span className="text-[10px] font-mono text-muted-foreground">{entity.country}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-sm transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Portfolio Breakdown */}
          <div>
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-3">
              Portfolio Breakdown
            </h3>
            <PieChart holdings={entity.holdings} />
          </div>

          {/* Holdings Table */}
          <div>
            <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">
              Holdings Detail
            </h3>
            <div className="space-y-2">
              {entity.holdings.map((holding, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-2 border-b border-border/20 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-medium text-sm">{holding.coinSymbol}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {holding.percentOfSupply.toFixed(3)}% of supply
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs tabular-nums">{formatCompact(holding.holdings)}</div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      ${formatCompact(holding.valueUsd)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div className="pt-3 border-t border-border/40">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase">
                  Total Value
                </div>
                <div className="text-sm font-semibold tabular-nums">
                  ${formatCompact(entity.totalValueUsd)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase">
                  Unrealized P&L
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold tabular-nums",
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
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Entity card */
function EntityCard({ entity, onClick }: { entity: TreasuryEntity; onClick: () => void }) {
  const hasKnownEntry = entity.entryValueUsd > 0;
  const primaryHolding = entity.holdings[0];

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 bg-card border border-border/40 rounded-lg hover:border-border hover:bg-secondary/20 transition-all tap-highlight group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-mono font-semibold text-sm truncate group-hover:text-foreground">
            {entity.entityName}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[9px] font-mono text-muted-foreground">{entity.symbol}</span>
            <span className="text-[9px] text-muted-foreground">·</span>
            <span className="text-[9px] text-muted-foreground">{entity.country}</span>
          </div>
        </div>
        {/* P&L indicator */}
        <div
          className={cn(
            "text-xs font-semibold tabular-nums px-1.5 py-0.5 rounded-sm",
            !hasKnownEntry
              ? "text-muted-foreground bg-secondary"
              : entity.unrealizedPnlPercent >= 0
                ? "text-gain bg-gain-muted"
                : "text-loss bg-loss-muted"
          )}
        >
          {hasKnownEntry
            ? `${entity.unrealizedPnlPercent >= 0 ? "+" : ""}${entity.unrealizedPnlPercent.toFixed(1)}%`
            : "N/A"}
        </div>
      </div>

      {/* Holdings summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {entity.holdings.slice(0, 3).map((h, idx) => (
            <span key={idx} className="text-[10px] font-mono bg-secondary px-1.5 py-0.5 rounded-sm">
              {h.coinSymbol}
            </span>
          ))}
          {entity.holdings.length > 3 && (
            <span className="text-[10px] text-muted-foreground">+{entity.holdings.length - 3}</span>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs font-semibold tabular-nums">
            ${formatCompact(entity.totalValueUsd)}
          </div>
          {primaryHolding && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {formatCompact(primaryHolding.holdings)} {primaryHolding.coinSymbol}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

/** Stats bar */
function StatsBar({ totalValue, entityCount }: { totalValue: number; entityCount: number }) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
          TOTAL VALUE
        </span>
        <span className="font-semibold tabular-nums">${formatCompact(totalValue)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wide">
          ENTITIES
        </span>
        <span className="font-semibold tabular-nums">{entityCount}</span>
      </div>
    </div>
  );
}

/** Main content */
function TreasuryContent({
  entities,
  totalValueUsd,
  entityCount,
}: {
  entities: readonly TreasuryEntity[];
  totalValueUsd: number;
  entityCount: number;
}) {
  const [selectedEntity, setSelectedEntity] = useState<TreasuryEntity | null>(null);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="container-fluid py-4 sm:py-6">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-5 sm:mb-6 border-b border-border/40 pb-4">
          <div>
            <h1 className="text-base sm:text-lg font-mono font-bold tracking-tight uppercase">
              Institutional Treasury
            </h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
              Public companies and ETFs holding crypto assets
            </p>
          </div>
          <StatsBar totalValue={totalValueUsd} entityCount={entityCount} />
        </header>

        {/* Entity Cards Grid */}
        <section>
          <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-mono font-medium text-muted-foreground uppercase tracking-wider">
                Top Holdings
              </h2>
              <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded-sm tabular-nums">
                {entities.length}
              </span>
            </div>
            <span className="hidden sm:block text-[9px] text-muted-foreground font-mono">
              TAP CARD FOR PORTFOLIO BREAKDOWN
            </span>
          </div>

          {entities.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-border/60 rounded-sm">
              <p className="text-xs text-muted-foreground font-mono">NO TREASURY DATA AVAILABLE</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {entities.slice(0, 20).map((entity, idx) => (
                <EntityCard
                  key={entity.symbol || idx}
                  entity={entity}
                  onClick={() => setSelectedEntity(entity)}
                />
              ))}
            </div>
          )}

          {entities.length > 20 && (
            <div className="mt-4 text-center text-[10px] text-muted-foreground font-mono">
              Showing top 20 of {entities.length} entities
            </div>
          )}
        </section>

        {/* Methodology Note */}
        <footer className="mt-6 pt-4 border-t border-border/40">
          <p className="text-[10px] text-muted-foreground font-mono leading-relaxed">
            Data sourced from CoinGecko Public Treasury API. P&L = (Current Value - Entry Cost) /
            Entry Cost. N/A indicates unknown cost basis.
          </p>
        </footer>
      </div>

      {/* Detail Modal */}
      {selectedEntity && (
        <EntityDetailModal entity={selectedEntity} onClose={() => setSelectedEntity(null)} />
      )}
    </div>
  );
}

/** Loading skeleton */
function TreasurySkeleton() {
  return (
    <div className="container-fluid py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6 border-b border-border/40 pb-4">
        <div>
          <Skeleton className="h-5 w-48 mb-1" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-4 w-48" />
      </div>
      <Skeleton className="h-5 w-32 mb-3" />
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

  if (isError || !data) {
    return (
      <div className="container-fluid py-6">
        <ErrorState
          title="Unable to load treasury data"
          retryAction={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <TreasuryContent
      entities={data.entities}
      totalValueUsd={data.totalValueUsd}
      entityCount={data.entityCount}
    />
  );
}
