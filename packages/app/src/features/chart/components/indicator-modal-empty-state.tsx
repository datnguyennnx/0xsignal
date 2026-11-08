import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { cn } from "cn";

interface IndicatorModalEmptyStateProps {
  normalizedQuery: string;
  explorerHidden: boolean;
  onClearSearch: () => void;
  onBrowseOverlays: () => void;
}

export function IndicatorModalEmptyState({
  normalizedQuery,
  explorerHidden,
  onClearSearch,
  onBrowseOverlays,
}: IndicatorModalEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center text-center",
        explorerHidden
          ? "@min-[72rem]:col-start-2 @min-[72rem]:col-span-3"
          : "@min-[72rem]:col-start-3 @min-[72rem]:col-span-2",
      )}
    >
      <EmptyState
        variant="panel"
        fill
        className="mx-auto w-full max-w-[24rem]"
        title={normalizedQuery ? "No indicators match" : "No indicators active yet"}
        description={
          normalizedQuery
            ? `Nothing matches "${normalizedQuery}".`
            : "Add an overlay or oscillator to track it on the chart."
        }
        action={
          normalizedQuery ? (
            <Button variant="outline" onClick={onClearSearch}>
              Clear search
            </Button>
          ) : (
            <Button variant="default" onClick={onBrowseOverlays}>
              Browse Overlays
            </Button>
          )
        }
      />
    </div>
  );
}
