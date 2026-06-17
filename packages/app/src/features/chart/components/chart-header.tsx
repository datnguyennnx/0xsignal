import { useMemo } from "react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { DEFAULT_INTERVALS, ALL_INTERVALS } from "../utils/constants";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface ChartHeaderProps {
  interval: string;
  onIntervalChange: (interval: string) => void;
  isIntervalSwitching?: boolean;
  children?: React.ReactNode;
}

export function ChartHeader({
  interval,
  onIntervalChange,
  isIntervalSwitching = false,
  children,
}: ChartHeaderProps) {
  const isDefaultInterval = useMemo(
    () => DEFAULT_INTERVALS.some((int) => int.value === interval),
    [interval],
  );

  const nonDefaultIntervals = ALL_INTERVALS.filter(
    (int) => !DEFAULT_INTERVALS.some((d) => d.value === int.value),
  );

  function handleIntervalChange(newInterval: string) {
    if (newInterval !== interval) {
      onIntervalChange(newInterval);
    }
  }

  return (
    <div className="flex items-center justify-between gap-[clamp(0.75rem,2vw,1rem)]">
      <div className="flex items-center gap-[clamp(0.75rem,2vw,1rem)]">
        <div className="flex items-center gap-[clamp(0.125rem,0.5vw,0.25rem)]">
          {DEFAULT_INTERVALS.map((int) => (
            <Button
              key={int.value}
              variant="ghost"
              size="sm"
              onClick={() => handleIntervalChange(int.value)}
              className={cn(
                "relative h-8 rounded-xl border px-2.5 py-4 text-[clamp(0.625rem,0.65rem+0.35vw,0.75rem)] tabular-nums tracking-[0.01em] transition-all duration-200 ease-premium active:scale-[0.97] focus-visible:ring-[2px] focus-visible:ring-ring/25",
                interval === int.value
                  ? "border-border/60 bg-muted/70 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              {int.label}
              {isIntervalSwitching && interval === int.value && (
                <span className="absolute -right-1 -top-0.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground" />
                </span>
              )}
            </Button>
          ))}
          {nonDefaultIntervals.length > 0 && (
            <NativeSelect
              size="sm"
              aria-label="More intervals"
              value={isDefaultInterval ? "" : interval}
              onChange={(e) => {
                if (e.target.value) handleIntervalChange(e.target.value);
              }}
              wrapperClassName="min-w-[clamp(4.5rem,12vw,6rem)] max-w-[clamp(4.5rem,12vw,6rem)]"
              className={cn(
                "h-8 w-full min-w-0 border border-border/50 bg-background/75 px-2.5 pr-7 text-[clamp(0.625rem,0.65rem+0.35vw,0.75rem)] tabular-nums tracking-[0.01em] cursor-pointer transition-[background-color,border-color,color,box-shadow] hover:bg-muted/40 focus-visible:ring-[2px] focus-visible:ring-ring/25",
                isDefaultInterval
                  ? "text-muted-foreground hover:text-foreground"
                  : "border-border/60 bg-muted/70 text-foreground",
              )}
            >
              {isDefaultInterval && (
                <NativeSelectOption value="" disabled>
                  More
                </NativeSelectOption>
              )}
              {nonDefaultIntervals.map((int) => (
                <NativeSelectOption key={int.value} value={int.value}>
                  {int.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </div>
      </div>
      <div className="flex items-center gap-[clamp(0.25rem,0.5vw,0.5rem)]">{children}</div>
    </div>
  );
}
