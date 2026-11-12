import { memo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { Surface } from "@/components/surface/surface";
import { formatChartPrice } from "../utils/price-format";
import { useHoverState } from "../contexts/hover-context";

interface ChartOhlcOverlayProps {
  data: ChartDataPoint[];
}

export const ChartOhlcOverlay = memo(({ data }: ChartOhlcOverlayProps) => {
  const { hoveredCandle } = useHoverState();

  // Use hovered candle OR last data point as fallback
  const displayCandle = hoveredCandle ?? data.at(-1) ?? null;

  if (!displayCandle) return null;

  return (
    <Surface
      tier="floating"
      radius="control"
      material="glass"
      className="pointer-events-none absolute top-2 left-2 z-30 px-2 py-[calc(0.35rem_+_0.175rem)] -my-0.5 type-data select-none overflow-x-auto scrollbar-hide w-fit max-w-[calc(100%-1rem)]"
    >
      <div className="flex items-center gap-inline min-w-fit">
        <span className="text-muted-foreground">
          O{" "}
          <span className="text-foreground tabular-nums">
            {formatChartPrice(displayCandle.open)}
          </span>
        </span>
        <span className="text-muted-foreground">
          H{" "}
          <span className="text-foreground tabular-nums">
            {formatChartPrice(displayCandle.high)}
          </span>
        </span>
        <span className="text-muted-foreground">
          L{" "}
          <span className="text-foreground tabular-nums">
            {formatChartPrice(displayCandle.low)}
          </span>
        </span>
        <span className="text-muted-foreground">
          C{" "}
          <span className="text-foreground tabular-nums">
            {formatChartPrice(displayCandle.close)}
          </span>
        </span>
      </div>
    </Surface>
  );
});

ChartOhlcOverlay.displayName = "ChartOhlcOverlay";
