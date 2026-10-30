import { useState, type JSX } from "react";
import type { WhalePosition } from "@0xsignal/shared";

import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/core/utils/formatters";
import { useCandleHistory } from "@/features/trade/hooks/use-candle-history";

import type { CoinMarket } from "../hooks/use-coin-market";
import { CoinPriceDialog, type SubjectPosition } from "./coin-price-dialog";
import CoinPriceSparkline from "./coin-price-sparkline";

const SPARKLINE_CANDLES = 48;
const SPARKLINE_HEIGHT_PX = 44;
const BUTTON_CLASS =
  "block w-full cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const FALLBACK_BUTTON_CLASS =
  "flex w-full cursor-not-allowed items-center justify-center rounded-md text-xs text-muted-foreground";

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

function deltaLabel(firstClose: number | undefined, lastClose: number | undefined): string | null {
  if (firstClose === undefined || lastClose === undefined || firstClose === 0) return null;
  const percent = ((lastClose - firstClose) / firstClose) * 100;
  if (!Number.isFinite(percent)) return null;
  return `${percent >= 0 ? "+" : "−"}${Math.abs(percent).toFixed(2)}%`;
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
  const delta = deltaLabel(firstClose, lastClose);
  const deltaTone = delta?.startsWith("+") === true ? "text-gain" : "text-loss";

  return (
    <div className="flex flex-col gap-2">
      {/* Price and count cannot share a 232px row, so each row pairs two short values. */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xl leading-none font-semibold">{coin.toUpperCase()}</h2>
          <span className="whitespace-nowrap text-[11px] tabular-nums text-muted-foreground">
            {countLabel(rows.length)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 whitespace-nowrap text-[28px] leading-none font-semibold tabular-nums">
            {price === null ? "—" : formatPrice(price)}
          </span>
          {delta !== null && (
            <span className={`shrink-0 whitespace-nowrap text-[11px] tabular-nums ${deltaTone}`}>
              {delta}
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="w-full" style={{ height: SPARKLINE_HEIGHT_PX }} />
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
          <div className="w-full" style={{ height: SPARKLINE_HEIGHT_PX }}>
            <CoinPriceSparkline candles={candles} />
          </div>
        </button>
      ) : (
        <button
          type="button"
          disabled
          className={FALLBACK_BUTTON_CLASS}
          style={{ height: SPARKLINE_HEIGHT_PX }}
        >
          No price history
        </button>
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
