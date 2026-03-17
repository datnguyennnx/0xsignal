/** @fileoverview OHLC overlay - displays current candle data */
import { memo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { formatPriceValue } from "./utils";

interface ChartOhlcOverlayProps {
  displayCandle: ChartDataPoint | null;
  precision: number;
}

export const ChartOhlcOverlay = memo(({ displayCandle, precision }: ChartOhlcOverlayProps) => {
  if (!displayCandle) return null;

  return (
    <div className="absolute top-2 left-2 z-30 flex items-center gap-3 px-2.5 py-1.5 bg-card/90 backdrop-blur-sm border border-border/30 rounded-md text-xs font-mono shadow-sm">
      <span className="text-muted-foreground">
        O <span className="text-foreground">{formatPriceValue(displayCandle.open, precision)}</span>
      </span>
      <span className="text-muted-foreground">
        H <span className="text-gain">{formatPriceValue(displayCandle.high, precision)}</span>
      </span>
      <span className="text-muted-foreground">
        L <span className="text-loss">{formatPriceValue(displayCandle.low, precision)}</span>
      </span>
      <span className="text-muted-foreground">
        C{" "}
        <span className={displayCandle.close >= displayCandle.open ? "text-gain" : "text-loss"}>
          {formatPriceValue(displayCandle.close, precision)}
        </span>
      </span>
    </div>
  );
});

ChartOhlcOverlay.displayName = "ChartOhlcOverlay";
