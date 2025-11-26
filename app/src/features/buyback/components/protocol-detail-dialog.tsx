import { memo, useCallback } from "react";
import { Exit, pipe } from "effect";
import type { BuybackSignal, ProtocolBuybackDetail } from "@0xsignal/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getCachedBuybackDetail } from "@/core/api/cached-queries";
import { useEffect_ } from "@/core/runtime/use-effect";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/core/utils/cn";

interface ProtocolDetailDialogProps {
  readonly signal: BuybackSignal | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

const formatCurrency = (value: number): string => {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
};

const Stat = memo(function Stat({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "gain" | "loss" | "default";
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-lg font-semibold tabular-nums mt-0.5 sm:text-xl",
          variant === "gain" && "text-gain",
          variant === "loss" && "text-loss"
        )}
      >
        {value}
      </div>
    </div>
  );
});

const DetailContent = memo(function DetailContent({ protocol }: { protocol: string }) {
  const fetchDetail = useCallback(() => getCachedBuybackDetail(protocol), [protocol]);
  const exit = useEffect_(fetchDetail, [protocol]);

  if (!exit) {
    return (
      <div className="py-12 flex justify-center">
        <div className="h-5 w-5 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  return pipe(
    exit,
    Exit.match({
      onFailure: () => (
        <div className="py-12 text-center text-sm text-muted-foreground">Unable to load data</div>
      ),
      onSuccess: (detail: ProtocolBuybackDetail) => {
        const yieldRate = detail.signal.annualizedBuybackRate;
        const growth = detail.signal.revenueGrowth7d ?? 0;

        return (
          <div className="space-y-5">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Revenue 24h" value={formatCurrency(detail.signal.revenue24h)} />
              <Stat label="Market Cap" value={formatCurrency(detail.signal.marketCap)} />
              <Stat
                label="Yield"
                value={`${yieldRate.toFixed(2)}%`}
                variant={yieldRate >= 10 ? "gain" : "default"}
              />
              <Stat
                label="P/Rev"
                value={detail.signal.impliedPE > 0 ? `${detail.signal.impliedPE.toFixed(1)}x` : "—"}
              />
            </div>

            {/* Growth indicator */}
            {growth !== 0 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">7d Growth</span>
                <span
                  className={cn("tabular-nums font-medium", growth > 0 ? "text-gain" : "text-loss")}
                >
                  {growth > 0 ? "+" : ""}
                  {growth.toFixed(1)}%
                </span>
              </div>
            )}

            {/* Chart */}
            {detail.dailyRevenue.length > 0 && (
              <div className="pt-2">
                <RevenueChart data={detail.dailyRevenue} />
              </div>
            )}

            {/* Revenue Source */}
            {detail.revenueSource && (
              <div className="pt-2 border-t border-border/40">
                <div className="text-xs text-muted-foreground mb-1">Revenue Source</div>
                <p className="text-sm leading-relaxed">{detail.revenueSource}</p>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/40 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Category</div>
                <div>{detail.signal.category}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-0.5">Chains</div>
                <div className="truncate">{detail.signal.chains.slice(0, 3).join(", ")}</div>
              </div>
            </div>
          </div>
        );
      },
    })
  );
});

export const ProtocolDetailDialog = memo(function ProtocolDetailDialog({
  signal,
  open,
  onOpenChange,
}: ProtocolDetailDialogProps) {
  if (!signal) return null;

  const protocolSlug = signal.protocol.toLowerCase().replace(/\s+/g, "-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <span className="font-semibold">{signal.symbol.toUpperCase()}</span>
            <span className="font-normal text-muted-foreground truncate">{signal.protocol}</span>
          </DialogTitle>
        </DialogHeader>
        <DetailContent protocol={protocolSlug} />
      </DialogContent>
    </Dialog>
  );
});
