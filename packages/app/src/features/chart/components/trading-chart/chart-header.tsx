import { memo, useCallback, useMemo } from "react";
import type { ChartDataPoint } from "@0xsignal/shared";
import { cn } from "@/core/utils/cn";
import { Button } from "@/components/ui/button";
import { DEFAULT_INTERVALS, ALL_INTERVALS } from "./constants";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

interface ChartHeaderProps {
  symbol: string;
  interval: string;
  displayCandle: ChartDataPoint | null;
  onIntervalChange: (interval: string) => void;
  isFetching?: boolean;
  children?: React.ReactNode;
}

export const ChartHeader = memo(function ChartHeader({
  symbol,
  interval,
  displayCandle,
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
    <div className="hidden sm:flex items-center justify-between gap-4 px-4 py-2.5 border-b border-border/50 bg-card">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          {DEFAULT_INTERVALS.map((int) => (
            <Button
              key={int.value}
              variant={interval === int.value ? "default" : "ghost"}
              size="sm"
              onClick={() => handleIntervalChange(int.value)}
              className={cn(
                "relative px-2.5 py-1 text-xs font-medium rounded-md transition-all duration-200 ease-premium",
                interval === int.value ? "scale-[1.02] shadow-sm" : ""
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
              value={isDefaultInterval ? "" : interval}
              onChange={(e) => {
                if (e.target.value) handleIntervalChange(e.target.value);
              }}
              className={cn(
                "bg-transparent text-xs font-medium px-2 py-1 cursor-pointer transition-colors",
                isDefaultInterval
                  ? "text-muted-foreground hover:text-foreground"
                  : "bg-primary text-primary-foreground"
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
