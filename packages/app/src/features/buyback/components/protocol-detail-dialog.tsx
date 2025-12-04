/**
 * Protocol Detail Dialog - memo kept for Dialog (prevents re-mount)
 * Uses Card components for consistent styling
 */

import { memo } from "react";
import type { BuybackSignal } from "@0xsignal/shared";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cachedBuybackDetail } from "@/core/cache/effect-cache";
import { useEffectQuery } from "@/core/runtime/use-effect-query";
import { RevenueChart } from "./revenue-chart";
import { cn } from "@/core/utils/cn";
import { formatCurrency } from "@/core/utils/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ProtocolDetailDialogProps {
  readonly signal: BuybackSignal | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant?: "gain" | "loss" | "default";
}) {
  return (
    <Card className="py-0 shadow-none">
      <CardContent className="p-3">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
        <div
          className={cn(
            "text-lg font-semibold tabular-nums mt-1",
            variant === "gain" && "text-gain",
            variant === "loss" && "text-loss"
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function DetailContent({ protocol }: { protocol: string }) {
  const {
    data: detail,
    isLoading,
    isError,
  } = useEffectQuery(() => cachedBuybackDetail(protocol), [protocol]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (isError || !detail) {
    return (
      <Card className="py-0 shadow-none">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">Unable to load protocol data</p>
          <p className="text-xs text-muted-foreground mt-1">
            Revenue data may be temporarily unavailable
          </p>
        </CardContent>
      </Card>
    );
  }

  const yieldRate = detail.signal.annualizedBuybackRate;
  const growth = detail.signal.revenueGrowth7d ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Revenue 24h" value={formatCurrency(detail.signal.revenue24h)} />
        <StatCard label="Market Cap" value={formatCurrency(detail.signal.marketCap)} />
        <StatCard
          label="Yield"
          value={`${yieldRate.toFixed(2)}%`}
          variant={yieldRate >= 10 ? "gain" : "default"}
        />
        <StatCard
          label="P/Rev"
          value={detail.signal.impliedPE > 0 ? `${detail.signal.impliedPE.toFixed(1)}x` : "—"}
        />
      </div>

      {growth !== 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">7d Growth</span>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              growth > 0 ? "text-gain border-gain/30" : "text-loss border-loss/30"
            )}
          >
            {growth > 0 ? "+" : ""}
            {growth.toFixed(1)}%
          </Badge>
        </div>
      )}

      {detail.dailyRevenue.length > 0 && (
        <Card className="py-0 shadow-none overflow-hidden">
          <CardContent className="p-4">
            <RevenueChart data={detail.dailyRevenue} />
          </CardContent>
        </Card>
      )}

      {detail.revenueSource && (
        <Card className="py-0 shadow-none">
          <CardContent className="p-4">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
              Revenue Source
            </div>
            <p className="text-sm leading-relaxed">{detail.revenueSource}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="py-0 shadow-none">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Category
            </div>
            <Badge variant="secondary" className="text-xs">
              {detail.signal.category}
            </Badge>
          </CardContent>
        </Card>
        <Card className="py-0 shadow-none">
          <CardContent className="p-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Chains
            </div>
            <div className="flex flex-wrap gap-1">
              {detail.signal.chains.map((chain) => (
                <Badge key={chain} variant="outline" className="text-[10px]">
                  {chain}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// memo kept - Dialog should not re-mount on parent re-renders
export const ProtocolDetailDialog = memo(function ProtocolDetailDialog({
  signal,
  open,
  onOpenChange,
}: ProtocolDetailDialogProps) {
  if (!signal) return null;
  const protocolSlug = signal.protocol.toLowerCase().replace(/\s+/g, "-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[calc(100%-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader className="pb-4">
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
