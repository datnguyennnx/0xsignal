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
    <div className="absolute top-2 left-2 right-2 z-30 px-2.5 py-1.5 bg-transparent rounded-lg text-[length:var(--text-data)] select-none overflow-x-auto scrollbar-hide w-fit">
      <Surface
        tier="floating"
        radius="overlay"
        blur={false}
        className="pointer-events-none absolute inset-0 -z-10"
      />
      <div className="flex items-center gap-[clamp(0.4rem,0.7vw,0.75rem)] min-w-fit">
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
    </div>
  );
});

ChartOhlcOverlay.displayName = "ChartOhlcOverlay";
