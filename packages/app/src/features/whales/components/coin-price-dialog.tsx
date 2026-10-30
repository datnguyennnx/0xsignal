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
  LADDER_MARK_BAND,
  mergeNearbyLevels,
  parsePx,
  type CoinMarket,
  type MergedLevel,
} from "../hooks/use-coin-market";
import { useWhaleCoinMarkers } from "../hooks/use-whale-coin-markers";

const TradingChart = lazy(() =>
  import("@/features/chart/components/trading-chart").then((m) => ({ default: m.TradingChart })),
);

const EMPTY_CAPTION_CLASS = "px-3 pt-1 text-[11px] text-muted-foreground";

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

/** The crowd row count separates "none in band" from "no rows for this coin". */
function levelCaption(
  subjectCount: number,
  crowdCount: number,
  crowdRowCount: number,
): string | null {
  if (crowdCount > 0) return null;
  if (subjectCount > 0) {
    return `No tracked liquidation from other whales within ${LADDER_MARK_BAND * 100}% of price.`;
  }
  if (crowdRowCount > 0) {
    return `No tracked liquidation within ${LADDER_MARK_BAND * 100}% of price.`;
  }
  return "No tracked level for this coin yet.";
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

  const { priceLines, caption } = useMemo(() => {
    if (markPx === null) return { priceLines: undefined, caption: null };
    const crowd = crowdLines(mergeNearbyLevels(summary.ladder, markPx));
    const subject = subjectLines(subjectPosition);
    return {
      priceLines: [...crowd, ...subject],
      caption: levelCaption(subject.length, crowd.length, summary.long.count + summary.short.count),
    };
  }, [markPx, summary, subjectPosition]);

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
        {caption !== null && <p className={EMPTY_CAPTION_CLASS}>{caption}</p>}
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
        className="inset-0! m-auto h-[min(80dvh,54rem)] max-w-[min(92vw,80rem)] grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden rounded-[20px] border border-white/10 p-0 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.65)] ring-1 ring-inset ring-white/10 [translate:none]! sm:max-w-[min(92vw,80rem)]"
      >
        {/* Glass sits below the content, so no backdrop-filter ancestor breaks nested overlays. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-card/60 backdrop-blur-2xl backdrop-saturate-150"
        />
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[inherit]">
          <CoinPriceDialogBody
            coin={coin}
            markPx={markPx}
            summary={summary}
            subjectPosition={subjectPosition}
          />
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] ring-1 ring-inset ring-white/10"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        />
      </DialogContent>
    </Dialog>
  );
}
