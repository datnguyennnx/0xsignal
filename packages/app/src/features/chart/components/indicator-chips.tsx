import { memo, type CSSProperties } from "react";
import type { ActiveIndicator } from "@0xsignal/shared";
import { cn } from "cn";
import { Surface } from "@/components/surface/surface";
import { toChipLabel } from "../utils/indicator-param-utils";

interface IndicatorChipsProps {
  indicators: ActiveIndicator[];
}

const SERIES_SLOTS = 8;

/** Same slot the overlay's line series picks, so the chip dot matches its line. */
function seriesToken(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = Math.imul(hash, 31) + (seed.codePointAt(i) ?? 0);
  }
  return `--data-${(Math.abs(hash) % SERIES_SLOTS) + 1}`;
}

/** Overlay strip: with no active indicators it returns null so the empty state occupies zero layout (deliberately no EmptyState). */
export const IndicatorChips = memo(function IndicatorChips({ indicators }: IndicatorChipsProps) {
  if (indicators.length === 0) {
    return null;
  }

  return (
    <div className="absolute top-12 left-2 right-2 z-20 pointer-events-none">
      <div className="flex flex-nowrap overflow-x-auto scrollbar-hide items-center gap-1 pointer-events-auto py-0.5 -my-0.5">
        {indicators.map((indicator) => {
          const style: CSSProperties & Record<"--series-color", string> = {
            "--series-color": `var(${seriesToken(indicator.instanceId)})`,
          };
          return (
            <div
              key={indicator.instanceId}
              style={style}
              className={cn(
                "relative flex items-center gap-1 rounded-overlay bg-transparent px-2 py-1 type-data shrink-0",
                indicator.visible ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Surface
                tier="floating"
                radius="overlay"
                material="none"
                variant="clear"
                overMedia
                dim
                className="pointer-events-none absolute inset-0 -z-10"
              />
              <span className="h-2 w-2 rounded-full shrink-0 bg-(--series-color)" />
              <span className="max-w-[clamp(5rem,25vw,7.5rem)] truncate">
                {toChipLabel(indicator)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
