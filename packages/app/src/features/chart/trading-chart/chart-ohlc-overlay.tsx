/**
 * @overview Trading Chart OHLC Overlay
 *
 * Renders the Open, High, Low, and Close prices for the currently hovered candle.
 * Features color-coded price changes (gain/loss) and high-precision formatting.
 */
import { memo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { formatPriceValue } from "./utils";
import { useHoverState } from "./contexts/hover-context";

interface ChartOhlcOverlayProps {
  data: ChartDataPoint[];
  precision: number;
}

export const ChartOhlcOverlay = memo(({ data, precision }: ChartOhlcOverlayProps) => {
  const { hoveredCandle } = useHoverState();

  // Use hovered candle OR last data point as fallback
  const displayCandle = hoveredCandle || (data.length > 0 ? data[data.length - 1] : null);

  if (!displayCandle) return null;

  return (
    <div className="absolute top-2 left-2 z-30 flex items-center gap-3 px-2.5 py-1.5 bg-card/90 backdrop-blur-sm rounded-xl text-xs font-mono shadow-sm select-none">
      <span className="text-muted-foreground">
        O{" "}
        <span className="text-foreground tabular-nums">
          {formatPriceValue(displayCandle.open, precision)}
        </span>
      </span>
      <span className="text-muted-foreground">
        H{" "}
        <span className="text-gain tabular-nums">
          {formatPriceValue(displayCandle.high, precision)}
        </span>
      </span>
      <span className="text-muted-foreground">
        L{" "}
        <span className="text-loss tabular-nums">
          {formatPriceValue(displayCandle.low, precision)}
        </span>
      </span>
      <span className="text-muted-foreground">
        C{" "}
        <span
          className={cn(
            displayCandle.close >= displayCandle.open ? "text-gain" : "text-loss",
            "tabular-nums"
          )}
        >
          {formatPriceValue(displayCandle.close, precision)}
        </span>
      </span>
    </div>
  );
});

ChartOhlcOverlay.displayName = "ChartOhlcOverlay";
