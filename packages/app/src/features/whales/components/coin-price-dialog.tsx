import { lazy, Suspense, useMemo, useState, type JSX } from "react";
import { useParams } from "react-router-dom";
import type { ClearinghouseState } from "@0xsignal/shared";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCompactUsd,
  formatPriceWithNSigFigs,
  RAW_PRICE_NSIG_FIGS,
} from "@/core/utils/formatters";
import type { ChartPriceLine } from "@/features/chart/lib/price-lines";

import {
  mergeNearbyLevels,
  parsePx,
  type CoinMarket,
  type MergedLevel,
} from "../hooks/use-coin-market";
import { useWhaleCoinMarkers } from "../hooks/use-whale-coin-markers";

const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart })),
);

/** The whale's own row from their clearinghouse state, not from the crowd page. */
export type SubjectPosition = ClearinghouseState["assetPositions"][number]["position"];

interface CoinPriceDialogProps {
  coin: string;
  markPx: number | null;
  summary: CoinMarket;
  subjectPosition: SubjectPosition | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function priceLabel(price: number): string {
  return formatPriceWithNSigFigs(price, RAW_PRICE_NSIG_FIGS);
}

function crowdTitle(level: MergedLevel): string {
  const side = level.side === "buy" ? "Long" : "Short";
  const whales = level.count === 1 ? "1 whale" : `${level.count} whales`;
  return `${whales} · ${side} ${formatCompactUsd(level.notional)}`;
}

/** No second cap: the hook already slices its ladder to the depth the axis can hold. */
function crowdLines(ladder: readonly MergedLevel[]): ChartPriceLine[] {
  return ladder.map((level) => ({
    price: level.price,
    tone: "muted",
    emphasis: "crowd",
    title: crowdTitle(level),
    axisLabelVisible: true,
  }));
}

function subjectLines(subjectPosition: SubjectPosition | undefined): ChartPriceLine[] {
  if (subjectPosition === undefined) return [];

  const lines: ChartPriceLine[] = [];
  const entry = parsePx(subjectPosition.entryPx);
  if (entry !== null) {
    lines.push({
      price: entry,
      tone: "accent",
      emphasis: "subject",
      title: `This whale · Entry ${priceLabel(entry)}`,
      dashed: true,
      axisLabelVisible: true,
    });
  }

  const liquidation = parsePx(subjectPosition.liquidationPx ?? undefined);
  if (liquidation !== null) {
    lines.push({
      price: liquidation,
      tone: "accent",
      emphasis: "subject",
      title: `This whale · Liq ${priceLabel(liquidation)}`,
      axisLabelVisible: true,
    });
  }

  return lines;
}

function CoinPriceDialogBody({
  coin,
  markPx,
  summary,
  subjectPosition,
}: Omit<CoinPriceDialogProps, "open" | "onOpenChange">): JSX.Element {
  // The chart's own header owns the interval; the prop is required, so it needs a local mirror.
  const [interval, setChartInterval] = useState("1h");
  const { address } = useParams<{ address?: string }>();

  const markers = useWhaleCoinMarkers(address, coin, interval);

  const priceLines = useMemo(
    () =>
      markPx === null
        ? undefined
        : [
            ...crowdLines(mergeNearbyLevels(summary.ladder, markPx)),
            ...subjectLines(subjectPosition),
          ],
    [markPx, summary, subjectPosition],
  );

  return (
    <>
      <DialogTitle className="sr-only">{coin} chart</DialogTitle>
      <div className="flex h-full min-h-0 flex-col">
        <Suspense fallback={<Skeleton className="min-h-0 flex-1" />}>
          <div className="min-h-0 flex-1">
            {/* The dialog outlives a coin switch, so the chart is keyed to the symbol. */}
            <TradingChart
              key={coin}
              symbol={coin}
              interval={interval}
              onIntervalChange={setChartInterval}
              priceLines={priceLines}
              markers={markers}
            />
          </div>
        </Suspense>
      </div>
    </>
  );
}

export function CoinPriceDialog({
  coin,
  markPx,
  summary,
  subjectPosition,
  open,
  onOpenChange,
}: CoinPriceDialogProps): JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Insets and auto margins, not a translate: a transform makes the popup a containing block. */}
      <DialogContent
        showCloseButton={false}
        className="inset-0! m-auto h-[min(80dvh,54rem)] max-w-[min(92vw,80rem)] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0 [translate:none]! sm:max-w-[min(92vw,80rem)]"
      >
        {/* DialogContent paints a solid surface over the scrim; this is layout only. */}
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden">
          <CoinPriceDialogBody
            coin={coin}
            markPx={markPx}
            summary={summary}
            subjectPosition={subjectPosition}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
