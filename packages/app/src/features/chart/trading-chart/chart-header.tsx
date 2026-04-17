/**
 * @overview Trading Chart Header
 *
 * Renders the top bar of the chart, containing interval selectors and action children.
 * Features specialized interval buttons with activity indicators (ping animation during fetch).
 */
import { memo, useCallback, useMemo } from "react";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { DEFAULT_INTERVALS, ALL_INTERVALS } from "./constants";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface ChartHeaderProps {
  interval: string;
  onIntervalChange: (interval: string) => void;
  isFetching?: boolean;
  children?: React.ReactNode;
}

export const ChartHeader = memo(function ChartHeader({
  interval,
  onIntervalChange,
  isFetching = false,
  children,
}: ChartHeaderProps) {
  const isDefaultInterval = useMemo(
    () => DEFAULT_INTERVALS.some((int) => int.value === interval),
    [interval]
  );

  const nonDefaultIntervals = useMemo(
    () => ALL_INTERVALS.filter((int) => !DEFAULT_INTERVALS.some((d) => d.value === int.value)),
    []
  );

  const handleIntervalChange = useCallback(
    (newInterval: string) => {
      if (newInterval !== interval) {
        onIntervalChange(newInterval);
      }
    },
    [onIntervalChange, interval]
  );

  return (
    <div className="hidden sm:flex items-center justify-between gap-4 px-4 py-2.5 bg-card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {DEFAULT_INTERVALS.map((int) => (
            <Button
              key={int.value}
              variant="ghost"
              size="sm"
              onClick={() => handleIntervalChange(int.value)}
              className={cn(
                "relative h-8 rounded-xl border px-2.5 py-1 text-[11px] font-mono tabular-nums tracking-[0.01em] transition-all duration-200 ease-premium active:scale-[0.97] focus-visible:ring-[2px] focus-visible:ring-ring/25",
                interval === int.value
                  ? "border-border/60 bg-muted/70 text-foreground scale-[1.02] shadow-sm"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {int.label}
              {isFetching && interval === int.value && (
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
              wrapperClassName="min-w-[4.5rem] max-w-[4.5rem]"
              className={cn(
                "h-8 w-full min-w-0 border border-border/50 bg-background/75 px-2.5 pr-7 text-[11px] font-mono tabular-nums tracking-[0.01em] cursor-pointer transition-[background-color,border-color,color,box-shadow] hover:bg-muted/40 focus-visible:ring-[2px] focus-visible:ring-ring/25",
                isDefaultInterval
                  ? "text-muted-foreground hover:text-foreground"
                  : "border-border/60 bg-muted/70 text-foreground"
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
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
});
