/**
 * Day Volume card — shows the day volume from portfolio data.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactUsd } from "@/core/utils/formatters";
import { usePortfolio } from "../hooks/use-portfolio-data";
import { VolumeHistoryDialog } from "./VolumeHistoryDialog";

export function VolumeCard() {
  const { data: portfolio, isLoading, isError } = usePortfolio();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Card className="border-border/20">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Day Volume
            </span>
            <button
              onClick={() => setDialogOpen(true)}
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              History
            </button>
          </div>

          {isLoading ? (
            <Skeleton className="h-7 w-28 rounded-sm" />
          ) : isError || !portfolio ? (
            <span className="text-xs text-muted-foreground/50">Unable to load volume</span>
          ) : (
            <span className="text-lg font-mono tabular-nums font-semibold text-foreground">
              {formatCompactUsd(Number(portfolio[0][1].vlm) || 0)}
            </span>
          )}
        </CardContent>
      </Card>

      <VolumeHistoryDialog open={dialogOpen} onOpenChange={setDialogOpen} portfolio={portfolio} />
    </>
  );
}
