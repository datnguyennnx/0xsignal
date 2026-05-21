/**
 * Volume History Dialog — shows volume across all periods.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCompactUsd } from "@/core/utils/formatters";
import type { PortfolioResponse } from "@/services/api";

interface VolumeHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolio: PortfolioResponse | undefined;
}

const PERIOD_LABELS: Record<string, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  allTime: "All Time",
};

const AGGREGATE_PERIODS = ["day", "week", "month", "allTime"] as const;

export function VolumeHistoryDialog({ open, onOpenChange, portfolio }: VolumeHistoryDialogProps) {
  // Extract the aggregate periods (day/week/month/allTime) — entries with matching keys
  const periods = portfolio
    ?.filter(([key]) => AGGREGATE_PERIODS.includes(key as (typeof AGGREGATE_PERIODS)[number]))
    .map(([, data]) => data);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] bg-card border-border/30">
        <DialogHeader>
          <DialogTitle className="text-sm font-medium text-foreground">Volume History</DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border/20">
          {periods && periods.length > 0 ? (
            periods.map((period, idx) => (
              <div
                key={AGGREGATE_PERIODS[idx] ?? idx}
                className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
              >
                <span className="text-xs text-muted-foreground">
                  {PERIOD_LABELS[AGGREGATE_PERIODS[idx]] ?? "—"}
                </span>
                <span className="text-sm font-mono tabular-nums text-foreground font-medium">
                  {formatCompactUsd(Number(period.vlm) || 0)}
                </span>
              </div>
            ))
          ) : (
            <div className="py-6 text-center">
              <span className="text-xs text-muted-foreground/50 uppercase tracking-wider font-mono">
                No volume data
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
