import { useState, type JSX } from "react";
import type { WhalePosition } from "@0xsignal/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/core/utils/formatters";
import { useCandleHistory } from "@/features/trade/hooks/use-candle-history";

import type { CoinMarket } from "../hooks/use-coin-market";
import { CoinPriceDialog, type SubjectPosition } from "./coin-price-dialog";
import CoinPriceSparkline from "./coin-price-sparkline";

const SPARKLINE_CANDLES = 48;
const BUTTON_CLASS =
  "block w-full cursor-pointer rounded-control focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const FALLBACK_CLASS =
  "flex w-full cursor-not-allowed items-center justify-center rounded-control type-label text-muted-foreground";

interface CoinPriceChartProps {
  coin: string;
  markPx: number | null;
  rows: readonly WhalePosition[];
  summary: CoinMarket;
  subjectPosition: SubjectPosition | undefined;
}

function countLabel(count: number): string {
  return count === 1 ? "1 tracked position" : `${count} tracked positions`;
}

function deltaPercent(
  firstClose: number | undefined,
  lastClose: number | undefined,
): number | null {
  if (firstClose === undefined || lastClose === undefined || firstClose === 0) return null;
  const percent = ((lastClose - firstClose) / firstClose) * 100;
  return Number.isFinite(percent) ? percent : null;
}

function deltaLabel(percent: number | null): string | null {
  if (percent === null) return null;
  return `${percent >= 0 ? "+" : "−"}${Math.abs(percent).toFixed(2)}%`;
}

function deltaTone(percent: number): string {
  if (Math.abs(percent) < 0.005) return "text-muted-foreground";
  return percent > 0 ? "text-gain" : "text-loss";
}

export function CoinPriceChart({
  coin,
  markPx,
  rows,
  summary,
  subjectPosition,
}: CoinPriceChartProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError } = useCandleHistory(coin, "1h", SPARKLINE_CANDLES);
  const candles = data ?? [];
  const hasHistory = !isError && candles.length > 0;
  const firstClose = candles.at(0)?.close;
  const lastClose = candles.at(-1)?.close;
  const price = markPx ?? lastClose ?? null;
  const percent = deltaPercent(firstClose, lastClose);
  const delta = deltaLabel(percent);

  return (
    <div className="flex flex-col gap-inline">
      {/* Price and count cannot share a 232px row, so each row pairs two short values. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-inline">
          <h2 className="type-title leading-none font-semibold">{coin.toUpperCase()}</h2>
          <span className="whitespace-nowrap type-data tabular-nums text-muted-foreground">
            {countLabel(rows.length)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-inline">
          <span className="min-w-0 whitespace-nowrap type-heading leading-none font-semibold tabular-nums">
            {price === null ? "—" : formatPrice(price)}
          </span>
          {delta !== null && percent !== null && (
            <span
              className={`shrink-0 whitespace-nowrap type-data tabular-nums ${deltaTone(percent)}`}
            >
              {delta}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="w-full" style={{ height: "var(--sparkline-h)" }} />
      ) : hasHistory ? (
        <button
          type="button"
          aria-label={`Open ${coin} chart`}
          className={BUTTON_CLASS}
          // Pointer clicks must not focus the trigger, else the keyboard ring shows on click.
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => {
            setOpen(true);
          }}
        >
          <div className="w-full" style={{ height: "var(--sparkline-h)" }}>
            <CoinPriceSparkline candles={candles} />
          </div>
        </button>
      ) : (
        <output className={FALLBACK_CLASS} style={{ height: "var(--sparkline-h)" }}>
          No price history
        </output>
      )}

      <CoinPriceDialog
        coin={coin}
        markPx={markPx}
        summary={summary}
        subjectPosition={subjectPosition}
        open={open}
        onOpenChange={setOpen}
      />
    </div>
  );
}
