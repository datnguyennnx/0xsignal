import { memo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { cn } from "cn";
import { LiquidGlass } from "@/components/glass";
import { formatPriceValue } from "../utils/price-format";
import { useHoverState } from "../contexts/hover-context";

interface ChartOhlcOverlayProps {
  data: ChartDataPoint[];
  precision: number;
}

export const ChartOhlcOverlay = memo(({ data, precision }: ChartOhlcOverlayProps) => {
  const { hoveredCandle } = useHoverState();

  // Use hovered candle OR last data point as fallback
  const displayCandle = hoveredCandle ?? data.at(-1) ?? null;

  if (!displayCandle) return null;

  return (
    <div className="absolute top-2 left-2 right-2 z-30 px-2.5 py-1.5 bg-transparent rounded-lg text-[length:var(--text-data)] select-none overflow-x-auto scrollbar-hide w-fit">
      <LiquidGlass borderRadius="inherit" tint="var(--material-raised-tint)" />
      <div className="flex items-center gap-[clamp(0.4rem,0.7vw,0.75rem)] min-w-fit">
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
              "tabular-nums",
            )}
          >
            {formatPriceValue(displayCandle.close, precision)}
          </span>
        </span>
      </div>
    </div>
  );
});

ChartOhlcOverlay.displayName = "ChartOhlcOverlay";
