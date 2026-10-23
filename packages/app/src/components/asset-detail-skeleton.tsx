import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { cellWidth, GRID_GUTTER_FRACTION } from "@/features/asset-detail/utils/collision";

/** Panel width as the percentage the live dashboard places it at (see ResizableWrapper). */
const panelWidth = (columns: number): string =>
  `${((columns * cellWidth() + (columns - 1) * GRID_GUTTER_FRACTION) * 100).toFixed(2)}%`;
const WIDE_COLUMNS = `${panelWidth(8)} ${panelWidth(2)} ${panelWidth(2)}`;
const WIDE_COLUMN_GAP = `${(GRID_GUTTER_FRACTION * 100).toFixed(2)}%`;

export function AssetDetailSkeleton() {
  return (
    <div className="container-fluid flex flex-col min-h-[var(--trading-region-height)] select-none animate-in fade-in duration-200 ease-premium">
      {/* Same header block as AssetContent, description line included, so the grid starts
          on the same Y as the loaded page. */}
      <header className="shrink-0 flex flex-col min-h-[calc(2.25rem_+_1.625*0.75rem_+_clamp(0.25rem,0.5vw,0.375rem))] pb-[clamp(0.25rem,0.5vw,0.375rem)]">
        <div className="flex h-9 items-center gap-2">
          <Skeleton className="size-5 shrink-0 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
      </header>
      <div className="container-query flex-1 min-h-0 flex flex-col">
        {/* Wide: same column tracks, column gutter and chart/positions split as the
            dashboard's initial layout (8/2/2 columns, 11/5 rows). */}
        <div
          className="hidden @[80rem]:grid flex-1 min-h-0 grid-rows-[minmax(0,1fr)]"
          style={{ gridTemplateColumns: WIDE_COLUMNS, columnGap: WIDE_COLUMN_GAP }}
        >
          <div className="min-h-0 grid grid-rows-[11fr_5fr] gap-2">
            <Skeleton className="min-h-0 rounded-lg" />
            <Skeleton className="min-h-0 rounded-lg" />
          </div>
          <Skeleton className="min-h-0 rounded-lg" />
          <Skeleton className="min-h-0 rounded-lg" />
        </div>
        {/* Narrow: the live grid's 7/3 columns and two equal rows. */}
        <div className="grid @[80rem]:hidden flex-1 min-h-0 grid-cols-[7fr_3fr] grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-[clamp(0.25rem,0.5vw,0.5rem)]">
          <Skeleton className="min-h-0 rounded-lg" />
          <Skeleton className="min-h-0 rounded-lg" />
          <Skeleton className="min-h-0 rounded-lg" />
          <Skeleton className="min-h-0 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function AssetDetailError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="container-fluid flex min-h-[var(--trading-region-height)] items-center justify-center py-6 overscroll-none animate-in fade-in duration-200 ease-premium">
      <ErrorState title={title} retryAction={onRetry} />
    </div>
  );
}
